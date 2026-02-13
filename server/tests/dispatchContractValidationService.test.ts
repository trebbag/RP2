import assert from "node:assert/strict"
import test from "node:test"

async function loadService() {
  process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/revenuepilot"
  process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-12345678901234567890"
  return import("../src/services/dispatchContractValidationService.js")
}

test("validateDispatchContract passes for FHIR target", async () => {
  const { validateDispatchContract } = await loadService()
  const result = validateDispatchContract({
    target: "FHIR_R4"
  })
  assert.equal(result.ok, true)
  assert.equal(result.contractType, "FHIR_BUNDLE_R4")
})

test("validateDispatchContract passes for HL7 target", async () => {
  const { validateDispatchContract } = await loadService()
  const result = validateDispatchContract({
    target: "HL7_V2"
  })
  assert.equal(result.ok, true)
  assert.equal(result.contractType, "HL7_ORU_R01")
})

test("dispatchSandboxReadiness reports missing endpoint for API targets", async () => {
  const { dispatchSandboxReadiness } = await loadService()
  const result = dispatchSandboxReadiness({
    target: "VENDOR_API",
    vendor: "GENERIC",
    webhookConfigured: false,
    mllpConfigured: false,
    authConfigured: false,
    mtlsConfigured: false
  })
  assert.equal(result.ready, false)
  assert.ok(result.checks.some((check) => check.key === "endpoint" && check.ok === false))
})
