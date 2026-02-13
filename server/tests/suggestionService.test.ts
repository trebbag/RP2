import assert from "node:assert/strict"
import test from "node:test"
import { buildSuggestionInputHash, generateSuggestions, shouldRefreshSuggestions } from "../src/services/suggestionService.js"

test("buildSuggestionInputHash is deterministic", () => {
  const input = {
    noteContent: "chest pain with smoking history",
    transcriptText: "Doctor: chest pain persists",
    chartContext: { medications: ["aspirin"] }
  }

  assert.equal(buildSuggestionInputHash(input), buildSuggestionInputHash(input))
})

test("generateSuggestions returns diagnosis and CPT candidates for chest pain", () => {
  const suggestions = generateSuggestions({
    noteContent: "Patient reports chest pain with exertion and smoking.",
    transcriptText: "Doctor discusses EKG",
    chartContext: { medications: ["aspirin"] }
  })

  assert.equal(suggestions.some((item) => item.code === "I25.10"), true)
  assert.equal(suggestions.some((item) => item.code === "93000"), true)
})

test("shouldRefreshSuggestions applies threshold policy", () => {
  assert.equal(shouldRefreshSuggestions({ noteDeltaChars: 10, transcriptDeltaChars: 10, secondsSinceLastRefresh: 20 }), false)
  assert.equal(shouldRefreshSuggestions({ noteDeltaChars: 150, transcriptDeltaChars: 0, secondsSinceLastRefresh: 20 }), true)
})
