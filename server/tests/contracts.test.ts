import assert from "node:assert/strict"
import test from "node:test"
import { billingEstimateSchema, composeOutputSchema, complianceIssueSchema, suggestionSchema } from "../src/services/schemas.js"

test("schema validation for suggestion payload", () => {
  const parsed = suggestionSchema.parse({
    code: "99213",
    codeType: "CPT",
    category: "CODE",
    title: "Office visit",
    description: "Baseline code",
    rationale: "Supported by note",
    confidence: 80,
    evidence: ["chief complaint"]
  })

  assert.equal(parsed.code, "99213")
})

test("schema validation for compliance issue payload", () => {
  const parsed = complianceIssueSchema.parse({
    severity: "WARNING",
    title: "Missing plan",
    description: "Plan required",
    rationale: "Denial risk",
    remediation: "Add plan",
    evidence: [],
    fingerprint: "abc123"
  })

  assert.equal(parsed.severity, "WARNING")
})

test("schema validation for compose and billing payloads", () => {
  const composeParsed = composeOutputSchema.parse({
    enhancedNote: "content",
    patientSummary: "summary",
    traceId: "trace_123",
    stages: [
      { id: 1, title: "Analyzing Content", status: "completed" },
      { id: 2, title: "Enhancing Structure", status: "completed" },
      { id: 3, title: "Beautifying Language", status: "completed" },
      { id: 4, title: "Final Review", status: "completed" }
    ]
  })

  const billingParsed = billingEstimateSchema.parse({
    payerModel: "MEDICARE",
    feeScheduleVersion: "2026.01",
    feeSchedulePackVersion: "payer-approved-2026.02",
    feeScheduleApprovedBy: "RevenuePilot Finance Committee",
    feeScheduleApprovedAt: "2026-02-01",
    feeScheduleSource: "CMS 2026",
    selectedCptCodes: ["99213"],
    allowedAmountCents: 100,
    deductibleAppliedCents: 0,
    copayCents: 0,
    coinsuranceCents: 20,
    estimatedChargeCents: 100,
    outOfPocketCents: 20,
    expectedReimbursementCents: 80,
    projectedRevenueDeltaCents: 10
  })

  assert.ok(composeParsed)
  assert.ok(billingParsed)
})
