import { assertNoPhiPayload, isForbiddenPhiKey } from "./phiGuards.js"

export interface TextRedactionSummary {
  emailCount: number
  phoneCount: number
  ssnCount: number
  dateCount: number
  total: number
}

export interface EncounterRedactionSummary extends TextRedactionSummary {
  droppedKeyPaths: string[]
}

export interface EncounterDeidentifyInput {
  noteContent?: string
  transcriptText?: string
  chartContext?: Record<string, unknown> | null
  metadata?: Record<string, unknown> | null
  selectedCodes?: string[]
  speakerHint?: string
  speakerHints?: string[]
}

export interface DeidentifiedEncounterContext {
  noteText: string
  transcriptText: string
  chartFacts: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  selectedCodes: string[]
  speakerHint?: string
  speakerHints: string[]
  redactionSummary: EncounterRedactionSummary
}

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
const PHONE_PATTERN = /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/g
const SSN_PATTERN = /\b\d{3}-?\d{2}-?\d{4}\b/g
const DATE_PATTERN =
  /\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{1,2},\s+\d{4})\b/gi

function replaceWithCount(
  input: string,
  pattern: RegExp,
  placeholder: string
): {
  text: string
  count: number
} {
  let count = 0
  const replaced = input.replace(pattern, () => {
    count += 1
    return placeholder
  })
  return {
    text: replaced,
    count
  }
}

function combineSummaries(parts: TextRedactionSummary[]): TextRedactionSummary {
  const emailCount = parts.reduce((total, part) => total + part.emailCount, 0)
  const phoneCount = parts.reduce((total, part) => total + part.phoneCount, 0)
  const ssnCount = parts.reduce((total, part) => total + part.ssnCount, 0)
  const dateCount = parts.reduce((total, part) => total + part.dateCount, 0)
  return {
    emailCount,
    phoneCount,
    ssnCount,
    dateCount,
    total: emailCount + phoneCount + ssnCount + dateCount
  }
}

export function deidentifyText(text: string): { text: string; redactionSummary: TextRedactionSummary } {
  const emailStep = replaceWithCount(text, EMAIL_PATTERN, "[REDACTED_EMAIL]")
  const phoneStep = replaceWithCount(emailStep.text, PHONE_PATTERN, "[REDACTED_PHONE]")
  const ssnStep = replaceWithCount(phoneStep.text, SSN_PATTERN, "[REDACTED_SSN]")
  const dateStep = replaceWithCount(ssnStep.text, DATE_PATTERN, "[REDACTED_DATE]")
  const redactionSummary: TextRedactionSummary = {
    emailCount: emailStep.count,
    phoneCount: phoneStep.count,
    ssnCount: ssnStep.count,
    dateCount: dateStep.count,
    total: emailStep.count + phoneStep.count + ssnStep.count + dateStep.count
  }
  return {
    text: dateStep.text,
    redactionSummary
  }
}

function sanitizeUnknown(
  value: unknown,
  path: string,
  droppedKeyPaths: string[],
  visited: WeakSet<object>
): {
  value: unknown
  summary: TextRedactionSummary
} {
  if (typeof value === "string") {
    const redacted = deidentifyText(value)
    return {
      value: redacted.text,
      summary: redacted.redactionSummary
    }
  }

  if (!value || typeof value !== "object") {
    return {
      value,
      summary: {
        emailCount: 0,
        phoneCount: 0,
        ssnCount: 0,
        dateCount: 0,
        total: 0
      }
    }
  }

  if (visited.has(value as object)) {
    return {
      value: null,
      summary: {
        emailCount: 0,
        phoneCount: 0,
        ssnCount: 0,
        dateCount: 0,
        total: 0
      }
    }
  }
  visited.add(value as object)

  if (Array.isArray(value)) {
    const sanitizedItems: unknown[] = []
    const summaries: TextRedactionSummary[] = []
    value.forEach((item, index) => {
      const nested = sanitizeUnknown(item, `${path}[${index}]`, droppedKeyPaths, visited)
      sanitizedItems.push(nested.value)
      summaries.push(nested.summary)
    })
    return {
      value: sanitizedItems,
      summary: combineSummaries(summaries)
    }
  }

  const sanitizedRecord: Record<string, unknown> = {}
  const summaries: TextRedactionSummary[] = []
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (isForbiddenPhiKey(key)) {
      droppedKeyPaths.push(`${path}.${key}`)
      continue
    }
    const sanitized = sanitizeUnknown(nested, `${path}.${key}`, droppedKeyPaths, visited)
    sanitizedRecord[key] = sanitized.value
    summaries.push(sanitized.summary)
  }

  return {
    value: sanitizedRecord,
    summary: combineSummaries(summaries)
  }
}

export function deidentifyEncounterContext(input: EncounterDeidentifyInput): DeidentifiedEncounterContext {
  const droppedKeyPaths: string[] = []
  const visited = new WeakSet<object>()

  const note = deidentifyText(input.noteContent ?? "")
  const transcript = deidentifyText(input.transcriptText ?? "")
  const speakerHint = input.speakerHint ? deidentifyText(input.speakerHint).text : undefined
  const speakerHints = (input.speakerHints ?? []).map((hint) => deidentifyText(hint).text)

  const chart = sanitizeUnknown(input.chartContext ?? null, "payload.chartContext", droppedKeyPaths, visited)
  const metadata = sanitizeUnknown(input.metadata ?? null, "payload.metadata", droppedKeyPaths, visited)
  const selectedCodes = (input.selectedCodes ?? []).map((code) => String(code).trim()).filter(Boolean)

  const redactionSummary: EncounterRedactionSummary = {
    ...combineSummaries([note.redactionSummary, transcript.redactionSummary, chart.summary, metadata.summary]),
    droppedKeyPaths: Array.from(new Set(droppedKeyPaths)).sort()
  }

  const deidentified: DeidentifiedEncounterContext = {
    noteText: note.text,
    transcriptText: transcript.text,
    chartFacts: (chart.value as Record<string, unknown> | null) ?? null,
    metadata: (metadata.value as Record<string, unknown> | null) ?? null,
    selectedCodes,
    speakerHint,
    speakerHints,
    redactionSummary
  }

  assertNoPhiPayload(deidentified)
  return deidentified
}

