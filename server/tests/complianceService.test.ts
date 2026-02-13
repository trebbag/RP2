import assert from "node:assert/strict"
import test from "node:test"
import { generateComplianceIssues } from "../src/services/complianceService.js"

test("generateComplianceIssues produces critical issues when core sections are missing", () => {
  const issues = generateComplianceIssues({
    noteContent: "short note",
    selectedCodes: []
  })

  const critical = issues.filter((issue) => issue.severity === "CRITICAL")
  assert.ok(critical.length > 0)
  assert.ok(issues.some((issue) => issue.title.includes("CPT")))
})

test("generateComplianceIssues produces fewer critical issues for complete notes", () => {
  const issues = generateComplianceIssues({
    noteContent: `HISTORY OF PRESENT ILLNESS:\nPatient has cough.\n\nASSESSMENT:\nLikely URI.\n\nPLAN:\nHydration and follow-up.`,
    selectedCodes: ["99213"]
  })

  assert.equal(issues.some((issue) => issue.severity === "CRITICAL"), false)
})
