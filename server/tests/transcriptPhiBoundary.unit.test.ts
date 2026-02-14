import assert from "node:assert/strict"
import test from "node:test"
import { z } from "zod"
import { runTask } from "../src/ai/aiGateway.js"
import { PhiViolationError } from "../src/ai/types.js"
import { generateSuggestionsOrchestrated } from "../src/services/suggestionService.js"

test("suggestions orchestration de-identifies transcript before reaching aiGateway", async () => {
  const rawTranscript = "Patient email j.doe@example.com phone 555-123-4567 ssn 111-22-3333"

  await assert.rejects(
    async () =>
      runTask({
        taskType: "suggestions",
        instructions: "Return suggestions JSON",
        payload: {
          noteText: "ASSESSMENT:\nChest pain.\nPLAN:\nEKG ordered.",
          transcriptText: rawTranscript,
          chartFacts: null
        },
        schema: z.array(z.unknown()),
        fallback: () => []
      }),
    (error: unknown) => {
      assert.equal(error instanceof PhiViolationError, true)
      const typed = error as PhiViolationError
      assert.equal(typed.details.reason, "phi_patterns")
      return true
    }
  )

  const captured: string[] = []
  const originalLog = console.log
  console.log = (...args: unknown[]) => {
    captured.push(args.map((item) => String(item)).join(" "))
  }

  try {
    await generateSuggestionsOrchestrated({
      noteContent: "ASSESSMENT:\nChest pain.\nPLAN:\nEKG ordered.",
      transcriptText: rawTranscript,
      chartContext: null
    })
  } finally {
    console.log = originalLog
  }

  const joined = captured.join("\n")
  assert.equal(joined.includes("j.doe@example.com"), false)
  assert.equal(joined.includes("555-123-4567"), false)
  assert.equal(joined.includes("111-22-3333"), false)
})
