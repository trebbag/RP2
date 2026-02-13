import assert from "node:assert/strict"
import test from "node:test"
import { z } from "zod"
import { runTask } from "../src/ai/aiGateway.js"
import { deidentifyEncounterContext, deidentifyText } from "../src/ai/deidentify.js"
import { containsForbiddenPhiKeys, detectPhiLikePatterns } from "../src/ai/phiGuards.js"
import { PhiViolationError } from "../src/ai/types.js"

test("containsForbiddenPhiKeys finds nested keys in objects and arrays", () => {
  const result = containsForbiddenPhiKeys({
    level1: {
      patientName: "Should not be present"
    },
    items: [{ ok: true }, { insuranceMemberId: "ABC-123" }]
  })

  assert.deepEqual(result.found, ["payload.items[1].insuranceMemberId", "payload.level1.patientName"])
})

test("detectPhiLikePatterns detects email, phone, and ssn patterns", () => {
  const detection = detectPhiLikePatterns({
    noteText: "Reach me at j.doe@example.com or 555-123-4567",
    metadata: {
      ref: "111-22-3333"
    }
  })

  const counts = Object.fromEntries(detection.matches.map((item) => [item.type, item.count]))
  assert.equal(counts.email, 1)
  assert.equal(counts.phone, 1)
  assert.equal(counts.ssn, 1)
})

test("deidentifyText redacts email/phone/ssn/date placeholders deterministically", () => {
  const input = "Email jane@example.com phone (555) 123-4567 ssn 111-22-3333 date 2026-02-13."
  const output = deidentifyText(input)

  assert.equal(output.text.includes("[REDACTED_EMAIL]"), true)
  assert.equal(output.text.includes("[REDACTED_PHONE]"), true)
  assert.equal(output.text.includes("[REDACTED_SSN]"), true)
  assert.equal(output.text.includes("[REDACTED_DATE]"), true)
  assert.equal(output.redactionSummary.emailCount, 1)
  assert.equal(output.redactionSummary.phoneCount, 1)
  assert.equal(output.redactionSummary.ssnCount, 1)
  assert.equal(output.redactionSummary.dateCount, 1)
})

test("deidentifyEncounterContext strips forbidden keys and outputs safe DTO", () => {
  const dto = deidentifyEncounterContext({
    noteContent: "Call me at 555-123-4567.",
    transcriptText: "Email doctor@example.com.",
    chartContext: {
      patientName: "PHI Name",
      labs: [{ panel: "CMP", result: "normal" }],
      insuranceId: "XYZ"
    }
  })

  const forbidden = containsForbiddenPhiKeys(dto)
  assert.deepEqual(forbidden.found, [])
  assert.equal(dto.noteText.includes("[REDACTED_PHONE]"), true)
  assert.equal(dto.transcriptText.includes("[REDACTED_EMAIL]"), true)
  assert.equal(dto.redactionSummary.droppedKeyPaths.includes("payload.chartContext.patientName"), true)
  assert.equal(dto.redactionSummary.droppedKeyPaths.includes("payload.chartContext.insuranceId"), true)
})

test("aiGateway runTask rejects forbidden key with safe metadata", async () => {
  await assert.rejects(
    async () =>
      runTask({
        taskType: "compose",
        instructions: "Return compose JSON",
        payload: {
          noteText: "No PHI in this field.",
          patientName: "Forbidden Name"
        },
        schema: z.object({
          enhancedNote: z.string(),
          patientSummary: z.string(),
          traceId: z.string(),
          stages: z.array(
            z.object({
              id: z.number(),
              title: z.string(),
              status: z.enum(["pending", "in-progress", "completed"])
            })
          )
        }),
        fallback: () => ({
          enhancedNote: "safe",
          patientSummary: "safe",
          traceId: "trace_safe",
          stages: []
        })
      }),
    (error: unknown) => {
      assert.equal(error instanceof PhiViolationError, true)
      const typed = error as PhiViolationError
      assert.equal(typed.details.reason, "forbidden_keys")
      assert.equal(typed.details.forbiddenKeyPaths?.includes("payload.patientName"), true)
      assert.equal(JSON.stringify(typed.details).includes("Forbidden Name"), false)
      return true
    }
  )
})

test("aiGateway logs payload stats without raw payload text", async () => {
  const captured: string[] = []
  const originalLog = console.log
  process.env.RP2_OFFLINE_AI = "1"

  console.log = (...args: unknown[]) => {
    captured.push(args.map((item) => String(item)).join(" "))
  }

  try {
    await runTask({
      taskType: "compose",
      instructions: "Return compose JSON",
      payload: {
        noteText: "UNIQUE_PHI_BOUNDARY_SENTINEL"
      },
      schema: z.object({
        enhancedNote: z.string(),
        patientSummary: z.string(),
        traceId: z.string(),
        stages: z.array(
          z.object({
            id: z.number(),
            title: z.string(),
            status: z.enum(["pending", "in-progress", "completed"])
          })
        )
      }),
      fallback: () => ({
        enhancedNote: "ok",
        patientSummary: "ok",
        traceId: "trace_ok",
        stages: []
      })
    })
  } finally {
    console.log = originalLog
    delete process.env.RP2_OFFLINE_AI
  }

  const joined = captured.join("\n")
  assert.equal(joined.includes("UNIQUE_PHI_BOUNDARY_SENTINEL"), false)
  assert.equal(joined.includes("ai_gateway.task_received"), true)
})

