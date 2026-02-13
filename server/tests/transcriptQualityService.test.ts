import assert from "node:assert/strict"
import test from "node:test"

async function loadService() {
  process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/revenuepilot"
  process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-12345678901234567890"
  return import("../src/services/transcriptQualityService.js")
}

test("flags low confidence and unknown speakers for review", async () => {
  const { buildTranscriptQualityReport } = await loadService()
  const report = buildTranscriptQualityReport([
    {
      id: "s1",
      speaker: "Doctor",
      text: "How are you feeling today?",
      confidence: 0.96,
      startMs: 0,
      endMs: 2500
    },
    {
      id: "s2",
      speaker: "UnknownSpeaker",
      text: "uh",
      confidence: 0.45,
      startMs: 2500,
      endMs: 3400
    }
  ])

  assert.equal(report.metrics.segmentCount, 2)
  assert.ok(report.metrics.lowConfidenceCount >= 1)
  assert.ok(report.metrics.unknownSpeakerCount >= 1)
  assert.equal(report.needsReview, true)
})

test("returns high score for stable transcript", async () => {
  const { buildTranscriptQualityReport } = await loadService()
  const report = buildTranscriptQualityReport([
    {
      id: "s1",
      speaker: "Doctor",
      text: "Your blood pressure has improved since your last visit.",
      confidence: 0.95,
      startMs: 0,
      endMs: 3000
    },
    {
      id: "s2",
      speaker: "Patient",
      text: "I have been taking the medication daily with no side effects.",
      confidence: 0.92,
      startMs: 3200,
      endMs: 6900
    }
  ])

  assert.ok(report.score >= 85)
  assert.equal(report.needsReview, false)
})
