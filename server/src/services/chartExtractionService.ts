import fs from "node:fs/promises"
import { createRequire } from "node:module"
import path from "node:path"
import { writeJsonFile } from "../utils/fs.js"

const require = createRequire(import.meta.url)

interface ChartExtractionInput {
  filePath: string
  fileName: string
  mimeType: string
}

interface LabRecord {
  name: string
  value: string
  unit?: string
  flag?: string
}

interface StructuredChart {
  extractedAt: string
  extraction: {
    method: "text" | "pdf_text" | "pdf_ocr" | "image_ocr"
    pageCount?: number
    ocrPageCount?: number
  }
  vitals: {
    bpSystolic?: number
    bpDiastolic?: number
    hrBpm?: number
    tempF?: number
    respiratoryRate?: number
    spo2Pct?: number
  }
  medications: string[]
  allergies: string[]
  pastMedicalHistory: string[]
  labs: LabRecord[]
  problems: string[]
}

function safeNumber(value: string | undefined): number | undefined {
  if (!value) return undefined
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function normalizeListValue(value: string): string[] {
  return value
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

function sectionList(lines: string[], labels: string[]): string[] {
  const collected: string[] = []
  const normalizedLabels = labels.map((label) => label.toLowerCase())

  for (const line of lines) {
    const lowered = line.toLowerCase()
    const hit = normalizedLabels.find((label) => lowered.startsWith(`${label}:`) || lowered.startsWith(`${label} -`))
    if (!hit) continue
    const value = line
      .slice(hit.length + 1)
      .trim()
      .replace(/^[-:]\s*/, "")
    collected.push(...normalizeListValue(value))
  }

  return Array.from(new Set(collected))
}

function parseLabs(lines: string[]): LabRecord[] {
  const labs: LabRecord[] = []
  const labPattern =
    /^\s*(?:lab|labs?)\s*[:\-]\s*([a-zA-Z0-9 .()%/-]+?)\s*[:=]\s*([a-zA-Z0-9.%/-]+)\s*([a-zA-Z/%]+)?\s*(H|L|high|low)?\s*$/i

  for (const line of lines) {
    const match = line.match(labPattern)
    if (!match) continue
    labs.push({
      name: match[1]?.trim() ?? "Lab",
      value: match[2]?.trim() ?? "",
      unit: match[3]?.trim() || undefined,
      flag: match[4]?.trim() || undefined
    })
  }

  return labs
}

function parseVitals(text: string) {
  const bp = text.match(/\b(?:BP|Blood Pressure)\s*[:=]?\s*(\d{2,3})\s*[\/\\]\s*(\d{2,3})/i)
  const hr = text.match(/\b(?:HR|Heart Rate|Pulse)\s*[:=]?\s*(\d{2,3})\b/i)
  const tempF = text.match(/\b(?:Temp|Temperature)\s*[:=]?\s*(\d{2,3}(?:\.\d+)?)\s*°?\s*F\b/i)
  const tempC = text.match(/\b(?:Temp|Temperature)\s*[:=]?\s*(\d{2}(?:\.\d+)?)\s*°?\s*C\b/i)
  const resp = text.match(/\b(?:RR|Respiratory Rate)\s*[:=]?\s*(\d{1,2})\b/i)
  const spo2 = text.match(/\b(?:SpO2|O2 Sat|Oxygen Saturation)\s*[:=]?\s*(\d{2,3})\s*%/i)

  const tempValueF =
    safeNumber(tempF?.[1]) ?? (safeNumber(tempC?.[1]) ? (safeNumber(tempC?.[1])! * 9) / 5 + 32 : undefined)

  return {
    bpSystolic: safeNumber(bp?.[1]),
    bpDiastolic: safeNumber(bp?.[2]),
    hrBpm: safeNumber(hr?.[1]),
    tempF: tempValueF ? Number(tempValueF.toFixed(1)) : undefined,
    respiratoryRate: safeNumber(resp?.[1]),
    spo2Pct: safeNumber(spo2?.[1])
  }
}

function readJsonTextIfPossible(rawText: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(rawText)
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>
    }
    return null
  } catch {
    return null
  }
}

function valuesToLines(value: unknown): string[] {
  if (value == null) return []
  if (Array.isArray(value)) {
    return value.flatMap((entry) => valuesToLines(entry))
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, nested]) => {
      if (typeof nested === "string" || typeof nested === "number" || typeof nested === "boolean") {
        return [`${key}: ${String(nested)}`]
      }
      return valuesToLines(nested)
    })
  }
  return [String(value)]
}

function isTextLikeMimeType(mimeType: string): boolean {
  if (mimeType.startsWith("text/")) return true
  return ["application/json", "application/xml", "text/csv", "application/csv", "text/plain"].includes(mimeType)
}

function isPdfLike(mimeType: string, ext: string): boolean {
  if (mimeType === "application/pdf") return true
  return ext === ".pdf"
}

function isImageLike(mimeType: string, ext: string): boolean {
  if (mimeType.startsWith("image/")) return true
  return [".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tif", ".tiff"].includes(ext)
}

async function findFileRecursive(dir: string, targetFileName: string, remainingDepth: number): Promise<string | null> {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isFile() && entry.name === targetFileName) {
      return fullPath
    }
  }

  if (remainingDepth <= 0) return null

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const nested = await findFileRecursive(path.join(dir, entry.name), targetFileName, remainingDepth - 1)
    if (nested) return nested
  }

  return null
}

let cachedEngLangPath: string | null = null

async function resolveEngLangPath(): Promise<string> {
  if (cachedEngLangPath) return cachedEngLangPath

  const packageJsonPath = require.resolve("@tesseract.js-data/eng/package.json")
  const baseDir = path.dirname(packageJsonPath)
  const trainedDataPath = await findFileRecursive(baseDir, "eng.traineddata.gz", 4)
  if (!trainedDataPath) {
    throw new Error("Tesseract language data not found for eng (expected eng.traineddata.gz).")
  }

  cachedEngLangPath = path.dirname(trainedDataPath)
  return cachedEngLangPath
}

let cachedPdfStandardFontDir: string | null = null

function resolvePdfStandardFontDir(): string {
  if (cachedPdfStandardFontDir) return cachedPdfStandardFontDir
  const pdfjsPackageJson = require.resolve("pdfjs-dist/package.json")
  const baseDir = path.dirname(pdfjsPackageJson)
  cachedPdfStandardFontDir = path.join(baseDir, "standard_fonts/")
  return cachedPdfStandardFontDir
}

async function runOcrOnImageBuffer(image: Buffer): Promise<string> {
  const langPath = await resolveEngLangPath()
  const { default: Tesseract } = (await import("tesseract.js")) as unknown as {
    default: {
      recognize: (image: Buffer, lang: string, options?: Record<string, unknown>) => Promise<{ data: { text: string } }>
    }
  }

  const result = await Tesseract.recognize(image, "eng", {
    langPath,
    logger: () => undefined
  })

  return result.data.text ?? ""
}

async function extractPdfEmbeddedText(pdfBuffer: Buffer): Promise<{ text: string; pageCount: number }> {
  const pdfjs = (await import("pdfjs-dist/legacy/build/pdf.mjs")) as unknown as {
    getDocument: (options: Record<string, unknown>) => { promise: Promise<any> }
  }

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(pdfBuffer),
    disableWorker: true,
    standardFontDataUrl: resolvePdfStandardFontDir()
  })

  const doc = await loadingTask.promise
  const pageCount = Number(doc.numPages ?? 0)
  let combined = ""

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const page = await doc.getPage(pageNumber)
    const textContent = await page.getTextContent()
    const items = (textContent.items ?? []) as Array<{ str?: string; transform?: number[] }>
    const lines = new Map<number, Array<{ x: number; text: string }>>()

    for (const item of items) {
      const text = (item.str ?? "").trim()
      if (!text) continue
      const transform = item.transform ?? []
      const x = Number(transform[4] ?? 0)
      const y = Number(transform[5] ?? 0)
      // Quantize Y to group nearby glyphs into the same line.
      const yKey = Math.round(y)
      const bucket = lines.get(yKey) ?? []
      bucket.push({ x, text })
      lines.set(yKey, bucket)
    }

    const ordered = Array.from(lines.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([, parts]) =>
        parts
          .sort((a, b) => a.x - b.x)
          .map((part) => part.text)
          .join(" ")
          .trim()
      )
      .filter(Boolean)

    if (ordered.length > 0) {
      combined += `${ordered.join("\n")}\n`
    }
  }

  return {
    text: combined.trim(),
    pageCount
  }
}

async function renderPdfPageToPngBuffer(page: any, scale: number): Promise<Buffer> {
  const { createCanvas } = (await import("@napi-rs/canvas")) as unknown as {
    createCanvas: (width: number, height: number) => any
  }

  class NodeCanvasFactory {
    create(width: number, height: number) {
      const canvas = createCanvas(width, height)
      const context = canvas.getContext("2d")
      // Ensure a deterministic background for OCR.
      context.fillStyle = "#ffffff"
      context.fillRect(0, 0, width, height)
      return { canvas, context }
    }

    reset(canvasAndContext: { canvas: any }, width: number, height: number) {
      canvasAndContext.canvas.width = width
      canvasAndContext.canvas.height = height
    }

    destroy(canvasAndContext: { canvas: any }) {
      canvasAndContext.canvas.width = 0
      canvasAndContext.canvas.height = 0
    }
  }

  const viewport = page.getViewport({ scale })
  const width = Math.max(1, Math.ceil(viewport.width))
  const height = Math.max(1, Math.ceil(viewport.height))
  const canvasFactory = new NodeCanvasFactory()
  const canvasAndContext = canvasFactory.create(width, height)

  await page.render({
    canvasContext: canvasAndContext.context,
    viewport,
    canvasFactory
  }).promise

  const buffer = canvasAndContext.canvas.toBuffer("image/png")
  canvasFactory.destroy(canvasAndContext)
  return buffer
}

async function imageObjectToPngBuffer(image: {
  width: number
  height: number
  data: Uint8Array | Uint8ClampedArray
}): Promise<Buffer> {
  const { createCanvas } = (await import("@napi-rs/canvas")) as unknown as {
    createCanvas: (width: number, height: number) => any
  }

  const width = Math.max(1, Math.floor(image.width))
  const height = Math.max(1, Math.floor(image.height))
  const pixelCount = width * height
  const raw = image.data

  let rgba: Uint8ClampedArray
  if (raw.length === pixelCount * 4) {
    rgba = raw instanceof Uint8ClampedArray ? raw : new Uint8ClampedArray(raw)
  } else if (raw.length === pixelCount * 3) {
    rgba = new Uint8ClampedArray(pixelCount * 4)
    for (let i = 0, j = 0; i < raw.length; i += 3, j += 4) {
      rgba[j] = raw[i] ?? 0
      rgba[j + 1] = raw[i + 1] ?? 0
      rgba[j + 2] = raw[i + 2] ?? 0
      rgba[j + 3] = 255
    }
  } else if (raw.length === pixelCount) {
    rgba = new Uint8ClampedArray(pixelCount * 4)
    for (let i = 0, j = 0; i < raw.length; i += 1, j += 4) {
      const v = raw[i] ?? 0
      rgba[j] = v
      rgba[j + 1] = v
      rgba[j + 2] = v
      rgba[j + 3] = 255
    }
  } else {
    throw new Error(`Unsupported chart image buffer size (len=${raw.length}, w=${width}, h=${height}).`)
  }

  const canvas = createCanvas(width, height)
  const context = canvas.getContext("2d")
  const imageData = context.createImageData(width, height)
  imageData.data.set(rgba)
  context.putImageData(imageData, 0, 0)
  return canvas.toBuffer("image/png")
}

async function extractLargestPageImagePngBuffer(
  page: any,
  ops: { paintImageXObject?: number; paintJpegXObject?: number }
): Promise<Buffer | null> {
  const opList = await page.getOperatorList()
  const fnArray = (opList.fnArray ?? []) as number[]
  const argsArray = (opList.argsArray ?? []) as unknown[]
  const imageIds = new Set<string>()

  for (let i = 0; i < fnArray.length; i += 1) {
    const fn = fnArray[i]
    if (fn !== ops.paintImageXObject && fn !== ops.paintJpegXObject) continue
    const args = argsArray[i] as unknown
    if (!Array.isArray(args)) continue
    const id = args[0]
    if (typeof id === "string" && id) imageIds.add(id)
  }

  if (imageIds.size === 0) return null

  const resolved: Array<{ width: number; height: number; data: Uint8Array | Uint8ClampedArray }> = []
  for (const id of imageIds) {
    const obj = await new Promise<any>((resolve) => page.objs.get(id, resolve))
    if (!obj || typeof obj.width !== "number" || typeof obj.height !== "number" || !obj.data) continue
    resolved.push({
      width: obj.width,
      height: obj.height,
      data: obj.data as Uint8Array | Uint8ClampedArray
    })
  }

  if (resolved.length === 0) return null

  const best = resolved.sort((a, b) => b.width * b.height - a.width * a.height)[0]!
  return imageObjectToPngBuffer(best)
}

async function extractPdfTextWithOcr(
  pdfBuffer: Buffer,
  maxPages: number
): Promise<{ text: string; pageCount: number }> {
  const pdfjs = (await import("pdfjs-dist/legacy/build/pdf.mjs")) as unknown as {
    getDocument: (options: Record<string, unknown>) => { promise: Promise<any> }
  }

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(pdfBuffer),
    disableWorker: true,
    standardFontDataUrl: resolvePdfStandardFontDir()
  })

  const doc = await loadingTask.promise
  const totalPages = Number(doc.numPages ?? 0)
  const pageCount = Math.min(totalPages, maxPages)

  let combined = ""
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const page = await doc.getPage(pageNumber)
    const png =
      (await extractLargestPageImagePngBuffer(page, (pdfjs as any).OPS ?? {})) ??
      (await renderPdfPageToPngBuffer(page, 2.6))
    const ocrText = await runOcrOnImageBuffer(png)
    if (ocrText.trim()) {
      combined += `${ocrText.trim()}\n`
    }
  }

  return {
    text: combined.trim(),
    pageCount
  }
}

async function readChartText(
  filePath: string,
  mimeType: string
): Promise<{ text: string; extraction: StructuredChart["extraction"] }> {
  if (isTextLikeMimeType(mimeType)) {
    return {
      text: await fs.readFile(filePath, "utf8"),
      extraction: { method: "text" }
    }
  }

  const ext = path.extname(filePath).toLowerCase()
  if (ext === ".txt" || ext === ".md" || ext === ".csv" || ext === ".json") {
    return {
      text: await fs.readFile(filePath, "utf8"),
      extraction: { method: "text" }
    }
  }

  if (isPdfLike(mimeType, ext)) {
    const pdfBuffer = await fs.readFile(filePath)
    const embedded = await extractPdfEmbeddedText(pdfBuffer)

    // If the PDF is scanned / image-based, embedded text is often empty.
    if (embedded.text.trim().length >= 40) {
      return {
        text: embedded.text,
        extraction: { method: "pdf_text", pageCount: embedded.pageCount }
      }
    }

    const ocr = await extractPdfTextWithOcr(pdfBuffer, 3)
    return {
      text: ocr.text,
      extraction: { method: "pdf_ocr", pageCount: embedded.pageCount, ocrPageCount: ocr.pageCount }
    }
  }

  if (isImageLike(mimeType, ext)) {
    const imageBuffer = await fs.readFile(filePath)
    const ocrText = await runOcrOnImageBuffer(imageBuffer)
    return {
      text: ocrText,
      extraction: { method: "image_ocr" }
    }
  }

  throw new Error(`Unsupported chart mime type: ${mimeType} (${ext || "no extension"})`)
}

export async function extractStructuredChart(input: ChartExtractionInput): Promise<{
  rawText: string
  extractedJson: StructuredChart
}> {
  const extractedAt = new Date().toISOString()
  const extractedText = await readChartText(input.filePath, input.mimeType)
  const rawText = extractedText.text
  const safeText = rawText
  const parsedJson = rawText ? readJsonTextIfPossible(rawText) : null

  const textLines = safeText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const jsonLines = parsedJson ? valuesToLines(parsedJson) : []
  const lines = [...textLines, ...jsonLines]

  const medications = sectionList(lines, ["medications", "meds", "current meds"])
  const allergies = sectionList(lines, ["allergies", "allergy"])
  const pastMedicalHistory = sectionList(lines, ["pmh", "past medical history", "past history"])
  const problems = sectionList(lines, ["problem list", "problems", "diagnoses"])
  const labs = parseLabs(lines)
  const vitals = parseVitals(safeText || lines.join("\n"))

  const extractedJson: StructuredChart = {
    extractedAt,
    extraction: extractedText.extraction,
    vitals,
    medications,
    allergies,
    pastMedicalHistory,
    labs,
    problems
  }

  return {
    rawText,
    extractedJson
  }
}

export async function persistStructuredChart(filePath: string, extractedJson: StructuredChart): Promise<number> {
  await writeJsonFile(filePath, extractedJson)
  const stats = await fs.stat(filePath)
  return Number(stats.size)
}
