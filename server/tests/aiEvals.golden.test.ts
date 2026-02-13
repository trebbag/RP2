import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const FIXTURE_DIR = path.resolve(process.cwd(), "tests", "fixtures", "ai-evals")

function configureTestEnv() {
  process.env.NODE_ENV = process.env.NODE_ENV || "test"
  process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/revenuepilot"
  process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-12345678901234567890"
  process.env.RP2_OFFLINE_AI = "1"
}

async function readFixture<T>(fileName: string): Promise<T> {
  const fullPath = path.resolve(FIXTURE_DIR, fileName)
  const raw = await fs.readFile(fullPath, "utf8")
  return JSON.parse(raw) as T
}

test("golden eval: suggestions task meets expected coding/content contract", async () => {
  configureTestEnv()

  const fixture = await readFixture<{
    input: {
      noteContent: string
      transcriptText: string
      chartContext?: Record<string, unknown>
    }
    expectations: {
      minCount: number
      expectedCodes: string[]
      requireEvidence: boolean
    }
  }>("suggestions-chest-pain.json")

  const { generateSuggestionsOrchestrated } = await import("../src/services/suggestionService.js")
  const result = await generateSuggestionsOrchestrated(fixture.input)

  assert.ok(result.output.length >= fixture.expectations.minCount)
  for (const code of fixture.expectations.expectedCodes) {
    assert.equal(
      result.output.some((item) => item.code === code),
      true,
      `Expected suggestion code ${code} not found.`
    )
  }

  if (fixture.expectations.requireEvidence) {
    assert.equal(result.output.every((item) => item.evidence.length > 0), true)
  }

  assert.equal(result.trace.promptVersionId?.startsWith("prompt-"), true)
  assert.equal(typeof result.prompt.versionId, "string")
})

test("golden eval: compliance task emits high-risk gaps and CPT warning", async () => {
  configureTestEnv()

  const fixture = await readFixture<{
    input: {
      noteContent: string
      selectedCodes: string[]
    }
    expectations: {
      minCritical: number
      requiredTitleFragments: string[]
      requireCptWarning: boolean
    }
  }>("compliance-missing-sections.json")

  const { generateComplianceIssuesOrchestrated } = await import("../src/services/complianceService.js")
  const result = await generateComplianceIssuesOrchestrated(fixture.input)

  const critical = result.output.filter((issue) => issue.severity === "CRITICAL")
  assert.ok(critical.length >= fixture.expectations.minCritical)

  for (const fragment of fixture.expectations.requiredTitleFragments) {
    assert.equal(
      result.output.some((issue) => issue.title.includes(fragment)),
      true,
      `Expected compliance issue title containing '${fragment}'.`
    )
  }

  if (fixture.expectations.requireCptWarning) {
    assert.equal(
      result.output.some((issue) => issue.title.toLowerCase().includes("cpt")),
      true,
      "Expected a CPT-related compliance issue when no CPT is selected."
    )
  }

  assert.equal(result.trace.promptVersionId?.startsWith("prompt-"), true)
})

test("golden eval: compose task emits structured note + patient summary", async () => {
  configureTestEnv()

  const fixture = await readFixture<{
    input: {
      noteContent: string
      patientName: string
    }
    expectations: {
      requiredEnhancedFragments: string[]
      requiredSummaryFragments: string[]
    }
  }>("compose-standard.json")

  const { composeNoteOrchestrated } = await import("../src/services/composeService.js")
  const result = await composeNoteOrchestrated(fixture.input)

  for (const fragment of fixture.expectations.requiredEnhancedFragments) {
    assert.equal(
      result.output.enhancedNote.includes(fragment),
      true,
      `Enhanced note missing expected fragment '${fragment}'.`
    )
  }

  for (const fragment of fixture.expectations.requiredSummaryFragments) {
    assert.equal(
      result.output.patientSummary.includes(fragment),
      true,
      `Patient summary missing expected fragment '${fragment}'.`
    )
  }

  assert.equal(result.output.stages.length, 4)
  assert.equal(result.trace.promptVersionId?.startsWith("prompt-"), true)
})

test("golden eval: diarization task returns speaker-tagged transcript segments", async () => {
  configureTestEnv()

  const fixture = await readFixture<{
    input: {
      transcriptText: string
      speakerHint?: string
      speakerHints?: string[]
    }
    expectations: {
      minSegments: number
      allowedSpeakers: string[]
      requireTracePrefix: string
    }
  }>("diarization-basic.json")

  const { diarizeTranscriptText } = await import("../src/services/sttService.js")
  const result = await diarizeTranscriptText(fixture.input)

  assert.ok(result.segments.length >= fixture.expectations.minSegments)
  assert.equal(result.trace.traceId.startsWith(fixture.expectations.requireTracePrefix), true)

  const normalizedAllowed = new Set(fixture.expectations.allowedSpeakers.map((item) => item.toLowerCase()))
  for (const segment of result.segments) {
    assert.equal(typeof segment.text, "string")
    assert.ok(segment.text.trim().length > 0)
    assert.equal(normalizedAllowed.has(segment.speaker.toLowerCase()), true)
  }

  assert.equal(result.trace.promptVersionId?.startsWith("prompt-"), true)
})
