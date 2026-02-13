import { PhiViolationError, type AiTaskType, type PhiPatternCount } from "./types.js"

export const FORBIDDEN_PHI_KEYS = [
  "patientName",
  "firstName",
  "lastName",
  "dob",
  "dateOfBirth",
  "mrn",
  "medicalRecordNumber",
  "ssn",
  "phone",
  "email",
  "address",
  "street",
  "zip",
  "city",
  "state",
  "insuranceMemberId",
  "insuranceId",
  "guarantor"
] as const

const FORBIDDEN_KEY_SET = new Set(FORBIDDEN_PHI_KEYS.map((key) => normalizeKey(key)))

export const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
export const PHONE_PATTERN = /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/g
export const SSN_PATTERN = /\b\d{3}-?\d{2}-?\d{4}\b/g

export function normalizeKey(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()
}

export function isForbiddenPhiKey(key: string): boolean {
  return FORBIDDEN_KEY_SET.has(normalizeKey(key))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function scanForbiddenKeys(
  value: unknown,
  path: string,
  found: Set<string>,
  visited: WeakSet<object>
) {
  if (!value || typeof value !== "object") return
  if (visited.has(value as object)) return
  visited.add(value as object)

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      scanForbiddenKeys(item, `${path}[${index}]`, found, visited)
    })
    return
  }

  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    const nestedPath = `${path}.${key}`
    if (isForbiddenPhiKey(key)) {
      found.add(nestedPath)
    }
    scanForbiddenKeys(nested, nestedPath, found, visited)
  }
}

export function containsForbiddenPhiKeys(obj: unknown): { found: string[] } {
  const found = new Set<string>()
  const visited = new WeakSet<object>()
  scanForbiddenKeys(obj, "payload", found, visited)
  return {
    found: Array.from(found).sort()
  }
}

function countPatternMatches(text: string, pattern: RegExp): number {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`
  const regex = new RegExp(pattern.source, flags)
  const matches = text.match(regex)
  return matches ? matches.length : 0
}

function scanPatternCounts(
  value: unknown,
  counts: Record<"email" | "phone" | "ssn", number>,
  visited: WeakSet<object>
) {
  if (typeof value === "string") {
    counts.email += countPatternMatches(value, EMAIL_PATTERN)
    counts.phone += countPatternMatches(value, PHONE_PATTERN)
    counts.ssn += countPatternMatches(value, SSN_PATTERN)
    return
  }

  if (!value || typeof value !== "object") return
  if (visited.has(value as object)) return
  visited.add(value as object)

  if (Array.isArray(value)) {
    value.forEach((item) => scanPatternCounts(item, counts, visited))
    return
  }

  if (isRecord(value)) {
    Object.values(value).forEach((nested) => scanPatternCounts(nested, counts, visited))
  }
}

export function detectPhiLikePatterns(obj: unknown): { matches: PhiPatternCount[] } {
  const counts: Record<"email" | "phone" | "ssn", number> = {
    email: 0,
    phone: 0,
    ssn: 0
  }
  const visited = new WeakSet<object>()
  scanPatternCounts(obj, counts, visited)

  const matches: PhiPatternCount[] = []
  if (counts.email > 0) matches.push({ type: "email", count: counts.email })
  if (counts.phone > 0) matches.push({ type: "phone", count: counts.phone })
  if (counts.ssn > 0) matches.push({ type: "ssn", count: counts.ssn })

  return { matches }
}

export function assertNoPhiPayload(payload: unknown, taskType?: AiTaskType) {
  const forbidden = containsForbiddenPhiKeys(payload)
  if (forbidden.found.length > 0) {
    throw new PhiViolationError("PHI boundary violation: forbidden keys detected in AI payload.", {
      reason: "forbidden_keys",
      taskType,
      forbiddenKeyPaths: forbidden.found
    })
  }

  const patternMatches = detectPhiLikePatterns(payload)
  if (patternMatches.matches.length > 0) {
    throw new PhiViolationError("PHI boundary violation: PHI-like patterns detected in AI payload.", {
      reason: "phi_patterns",
      taskType,
      patternCounts: patternMatches.matches
    })
  }
}

