#!/usr/bin/env node

import { promises as fs } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, "..")
const serverSrcRoot = path.join(repoRoot, "server", "src")

const FORBIDDEN_PHI_KEYS = [
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
]

const ALLOWED_FILES = new Set([
  path.normalize(path.join(serverSrcRoot, "ai", "deidentify.ts")),
  path.normalize(path.join(serverSrcRoot, "ai", "phiGuards.ts"))
])

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

const forbiddenAlternation = FORBIDDEN_PHI_KEYS.map(escapeRegExp).join("|")
const AI_CALL_PATTERN = /\b(runJsonTask|runTask)\s*\(/
const OBJECT_KEY_PATTERN = new RegExp(`(?:^|[\\s,{])["']?(${forbiddenAlternation})["']?\\s*:`, "gi")
const PROPERTY_ASSIGNMENT_PATTERN = new RegExp(`\\.\\s*(${forbiddenAlternation})\\s*=`, "gi")
const SHORTHAND_PATTERN = new RegExp(`[{,]\\s*(${forbiddenAlternation})\\s*(?=,|})`, "gi")

function toLineColumn(text, index) {
  const before = text.slice(0, index)
  const lines = before.split("\n")
  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1
  }
}

function findMatches(text, pattern, type) {
  const matches = []
  pattern.lastIndex = 0
  let match = pattern.exec(text)
  while (match) {
    const index = match.index
    const key = match[1]
    const { line, column } = toLineColumn(text, index)
    matches.push({ key, line, column, type })
    match = pattern.exec(text)
  }
  return matches
}

async function walkTsFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) return walkTsFiles(fullPath)
      if (entry.isFile() && fullPath.endsWith(".ts") && !fullPath.endsWith(".d.ts")) return [fullPath]
      return []
    })
  )
  return files.flat()
}

function formatViolation(filePath, match) {
  const relative = path.relative(repoRoot, filePath)
  return `- ${relative}:${match.line}:${match.column} (${match.type}) uses forbidden key '${match.key}' in AI payload layer`
}

async function main() {
  const files = await walkTsFiles(serverSrcRoot)
  const violations = []

  for (const filePath of files) {
    const normalized = path.normalize(filePath)
    if (ALLOWED_FILES.has(normalized)) continue

    const content = await fs.readFile(filePath, "utf8")
    if (!AI_CALL_PATTERN.test(content)) continue

    const matches = [
      ...findMatches(content, OBJECT_KEY_PATTERN, "object_key"),
      ...findMatches(content, PROPERTY_ASSIGNMENT_PATTERN, "property_assignment"),
      ...findMatches(content, SHORTHAND_PATTERN, "shorthand")
    ]

    if (matches.length > 0) {
      for (const match of matches) {
        violations.push(formatViolation(filePath, match))
      }
    }
  }

  if (violations.length > 0) {
    console.error("PHI lint failed. Forbidden PHI keys detected in AI payload/orchestration layers:")
    for (const violation of violations) {
      console.error(violation)
    }
    process.exit(1)
  }

  console.log("PHI lint passed. No forbidden PHI keys found in AI payload/orchestration layers.")
}

main().catch((error) => {
  console.error("Failed to run lint:phi", error instanceof Error ? error.message : error)
  process.exit(1)
})
