import assert from "node:assert/strict"
import test from "node:test"
import { composeNote } from "../src/services/composeService.js"

test("composeNote returns enhanced note, patient summary, and trace id", () => {
  const output = composeNote({
    noteContent: "chief complaint:\nchest pain for two days\nplan:\nobtain ekg",
    patientName: "John Smith"
  })

  assert.ok(output.enhancedNote.includes("CHIEF COMPLAINT"))
  assert.ok(output.patientSummary.includes("Visit Summary for John Smith"))
  assert.equal(output.traceId.startsWith("trace_"), true)
  assert.equal(output.stages.length, 4)
})
