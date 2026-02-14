import assert from "node:assert/strict"
import test from "node:test"
import supertest from "supertest"
import { clearTablesInOrder, createAdminPrisma, resolveIntegrationAdminDbUrl } from "./helpers/adminDb.js"

const shouldRunIntegration = process.env.RP2_RUN_INTEGRATION === "1"
const integrationDbUrl = process.env.RP2_INTEGRATION_DB_URL || process.env.DATABASE_URL
const integrationAdminDbUrl = resolveIntegrationAdminDbUrl()

if (!shouldRunIntegration || !integrationDbUrl || !integrationAdminDbUrl) {
  test("multi-tenant isolation integration (skipped)", { skip: true }, () => {
    assert.ok(true)
  })
} else {
  test("multi-tenant isolation: cross-org reads and exports are blocked", async () => {
    process.env.DATABASE_URL = integrationDbUrl
    process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-jwt-secret-1234567890"
    process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173"
    process.env.STORAGE_DIR = process.env.STORAGE_DIR || "./storage"
    process.env.RP2_OFFLINE_AI = process.env.RP2_OFFLINE_AI || "1"

    const { createApp } = await import("../src/app.js")
    const adminPrisma = createAdminPrisma()

    const app = createApp()
    const request = supertest(app)

    await adminPrisma.$connect()
    await clearTablesInOrder(adminPrisma)

    const login = async (input: {
      email: string
      name: string
      role: "ADMIN" | "MA" | "CLINICIAN"
      orgSlug: string
      orgName: string
    }) => {
      const response = await request.post("/api/auth/dev-login").send(input)
      assert.equal(response.status, 200)
      return {
        headers: { Authorization: `Bearer ${response.body.token}` },
        orgId: response.body.user.orgId as string
      }
    }

    const orgAUser = await login({
      email: "tenant.a.clinician@revenuepilot.local",
      name: "Tenant A Clinician",
      role: "CLINICIAN",
      orgSlug: "tenant-a",
      orgName: "Tenant A"
    })

    const orgBUser = await login({
      email: "tenant.b.clinician@revenuepilot.local",
      name: "Tenant B Clinician",
      role: "CLINICIAN",
      orgSlug: "tenant-b",
      orgName: "Tenant B"
    })

    const createdAppointment = await request
      .post("/api/appointments")
      .set(orgAUser.headers)
      .send({
        patientName: "Tenant Isolation Patient",
        patientPhone: "(555) 303-0000",
        patientEmail: "tenant.isolation@example.com",
        appointmentTime: new Date(Date.now() + 120_000).toISOString(),
        duration: 30,
        appointmentType: "Follow-up",
        provider: "Dr. TenantA",
        location: "Room A",
        notes: "multi-tenant isolation test",
        priority: "medium",
        isVirtual: false
      })

    assert.equal(createdAppointment.status, 201)
    const encounterExternalId = createdAppointment.body.appointment.encounterId as string
    assert.ok(encounterExternalId)

    const encounterRow = await adminPrisma.encounter.findFirst({
      where: {
        orgId: orgAUser.orgId,
        externalId: encounterExternalId
      },
      select: { id: true }
    })
    assert.ok(encounterRow)

    const crossOrgEncounterExternal = await request
      .get(`/api/encounters/${encodeURIComponent(encounterExternalId)}`)
      .set(orgBUser.headers)
    assert.equal(crossOrgEncounterExternal.status, 404)

    const crossOrgEncounterInternal = await request
      .get(`/api/encounters/${encodeURIComponent(encounterRow!.id)}`)
      .set(orgBUser.headers)
    assert.equal(crossOrgEncounterInternal.status, 404)

    const orgBDrafts = await request.get("/api/drafts").set(orgBUser.headers)
    assert.equal(orgBDrafts.status, 200)
    assert.equal(Array.isArray(orgBDrafts.body.drafts), true)
    assert.equal(orgBDrafts.body.drafts.length, 0)

    const compose = await request
      .post(`/api/wizard/${encodeURIComponent(encounterExternalId)}/compose`)
      .set(orgAUser.headers)
      .send({ noteContent: "ASSESSMENT:\nStable.\nPLAN:\nFollow up." })
    assert.equal(compose.status, 200)

    const finalize = await request
      .post(`/api/wizard/${encodeURIComponent(encounterExternalId)}/finalize`)
      .set(orgAUser.headers)
      .send({
        finalNote: compose.body.enhancedNote,
        finalPatientSummary: compose.body.patientSummary,
        attestClinicalAccuracy: true,
        attestBillingAccuracy: true
      })
    assert.equal(finalize.status, 200)
    assert.equal(Array.isArray(finalize.body.artifacts), true)
    assert.ok(finalize.body.artifacts.length >= 1)

    const artifactId = (finalize.body.artifacts[0] as { id: string }).id
    assert.ok(artifactId)

    const crossOrgArtifact = await request.get(`/api/exports/${encodeURIComponent(artifactId)}`).set(orgBUser.headers)
    assert.equal(crossOrgArtifact.status, 404)

    await clearTablesInOrder(adminPrisma)
    await adminPrisma.$disconnect()
  })
}
