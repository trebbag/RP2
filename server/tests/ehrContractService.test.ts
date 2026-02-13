import assert from "node:assert/strict"
import test from "node:test"

const basePayload = {
  encounterExternalId: "ENC-123",
  patientExternalId: "PAT-123",
  providerName: "Dr. Test",
  noteContent: "Assessment and plan content.",
  patientSummary: "Summary for patient.",
  billing: {
    payerModel: "MEDICARE",
    selectedCptCodes: ["99213", "93000"],
    estimatedChargeCents: 22000,
    expectedReimbursementCents: 17800
  },
  artifacts: [
    { id: "a1", type: "NOTE_PDF", fileName: "clinical-note.pdf" },
    { id: "a2", type: "PATIENT_SUMMARY_PDF", fileName: "patient-summary.pdf" }
  ],
  dispatchMetadata: {
    idempotencyKey: "dispatch-key-001",
    contractVersion: "v2",
    dispatchedAt: "2026-02-11T00:00:00.000Z"
  }
}

async function loadService() {
  process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/revenuepilot"
  process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-12345678901234567890"
  return import("../src/services/ehrContractService.js")
}

test("builds FHIR bundle dispatch contract", async () => {
  const { buildDispatchContractForConfig } = await loadService()
  const result = buildDispatchContractForConfig(basePayload, {
    target: "FHIR_R4"
  })

  assert.equal(result.contractType, "FHIR_BUNDLE_R4")
  assert.equal(result.contentType, "application/fhir+json")
  const parsed = JSON.parse(result.body) as { resourceType: string; entry: unknown[]; identifier?: { value?: string } }
  assert.equal(parsed.resourceType, "Bundle")
  assert.ok(Array.isArray(parsed.entry))
  assert.ok(parsed.entry.length >= 3)
  assert.equal(parsed.identifier?.value, "dispatch-key-001")
})

test("builds HL7 ORU contract", async () => {
  const { buildDispatchContractForConfig } = await loadService()
  const result = buildDispatchContractForConfig(basePayload, {
    target: "HL7_V2"
  })

  assert.equal(result.contractType, "HL7_ORU_R01")
  assert.equal(result.contentType, "text/plain")
  assert.ok(result.body.includes("MSH|^~\\&|RP2|REVENUEPILOT|EHR|TARGET|"))
  assert.ok(result.body.includes("OBX|1|TX|NOTE^Final Clinical Note"))
  assert.ok(result.body.includes("ZDS|dispatch-key-001|v2"))
})

test("builds vendor JSON contract for configured vendor", async () => {
  const { buildDispatchContractForConfig } = await loadService()
  const result = buildDispatchContractForConfig(basePayload, {
    target: "VENDOR_API",
    vendor: "ATHENAHEALTH"
  })

  assert.equal(result.contractType, "VENDOR_JSON")
  assert.equal(result.contentType, "application/json")
  const parsed = JSON.parse(result.body) as { sourceSystem: string; athenaEncounterId: string; dispatchMetadata?: { idempotencyKey?: string } }
  assert.equal(parsed.sourceSystem, "RevenuePilot")
  assert.equal(parsed.athenaEncounterId, basePayload.encounterExternalId)
  assert.equal(parsed.dispatchMetadata?.idempotencyKey, "dispatch-key-001")
})

test("returns NONE contract when dispatch target is disabled", async () => {
  const { buildDispatchContractForConfig } = await loadService()
  const result = buildDispatchContractForConfig(basePayload, {
    target: "NONE"
  })

  assert.equal(result.contractType, "NONE")
  const parsed = JSON.parse(result.body) as { dispatched: boolean }
  assert.equal(parsed.dispatched, false)
})
