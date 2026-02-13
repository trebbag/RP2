import fs from "node:fs"
import fsp from "node:fs/promises"
import path from "node:path"
import PDFDocument from "pdfkit"
import { ensureDir } from "../utils/fs.js"

interface PdfPayload {
  title: string
  subtitle?: string
  content: string
}

export async function createPdfArtifact(baseDir: string, fileName: string, payload: PdfPayload) {
  await ensureDir(baseDir)
  const outputPath = path.join(baseDir, fileName)

  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 })
    const stream = fs.createWriteStream(outputPath)

    stream.on("finish", () => resolve())
    stream.on("error", reject)

    doc.pipe(stream)

    doc.fontSize(20).text(payload.title, { underline: true })
    if (payload.subtitle) {
      doc.moveDown(0.5)
      doc.fontSize(11).fillColor("#4B5563").text(payload.subtitle)
      doc.fillColor("#111827")
    }

    doc.moveDown()
    doc.fontSize(12).text(payload.content, {
      lineGap: 4
    })

    doc.end()
  })

  const stats = await fsp.stat(outputPath)
  return {
    filePath: outputPath,
    sizeBytes: stats.size,
    mimeType: "application/pdf"
  }
}
