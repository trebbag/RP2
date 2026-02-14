import assert from "node:assert/strict"
import test from "node:test"
import supertest from "supertest"
import { clearTablesInOrder, createAdminPrisma, resolveIntegrationAdminDbUrl } from "./helpers/adminDb.js"

const shouldRunIntegration = process.env.RP2_RUN_INTEGRATION === "1"
const integrationDbUrl = process.env.RP2_INTEGRATION_DB_URL || process.env.DATABASE_URL
const integrationAdminDbUrl = resolveIntegrationAdminDbUrl()

if (!shouldRunIntegration || !integrationDbUrl || !integrationAdminDbUrl) {
  test("transcript retention integration (skipped)", { skip: true }, () => {
    assert.ok(true)
  })
} else {
  test("transcript retention policy redacts transcript text after retention window", async () => {
    process.env.DATABASE_URL = integrationDbUrl
    process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-jwt-secret-1234567890"
    process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173"
    process.env.STORAGE_DIR = process.env.STORAGE_DIR || "./storage"

    const { createApp } = await import("../src/app.js")
    const adminPrisma = createAdminPrisma()

    const app = createApp()
    const request = supertest(app)

    await adminPrisma.$connect()
    await clearTablesInOrder(adminPrisma)

    const adminLogin = await request.post("/api/auth/dev-login").send({
      email: "integration.retention.admin@revenuepilot.local",
      name: "Retention Admin",
      role: "ADMIN"
    })
    assert.equal(adminLogin.status, 200)
    const adminAuth = { Authorization: `Bearer ${adminLogin.body.token}` }
    const orgId = adminLogin.body.user.orgId as string

    const clinicianLogin = await request.post("/api/auth/dev-login").send({
      email: "integration.retention.clinician@revenuepilot.local",
      name: "Retention Clinician",
      role: "CLINICIAN"
    })
    assert.equal(clinicianLogin.status, 200)
    const clinicianAuth = { Authorization: `Bearer ${clinicianLogin.body.token}` }

    const createdAppointment = await request
      .post("/api/appointments")
      .set(clinicianAuth)
      .send({
        patientName: "Retention Patient",
        patientPhone: "(555) 222-2222",
        patientEmail: "retention.patient@example.com",
        appointmentTime: new Date(Date.now() + 60_000).toISOString(),
        duration: 30,
        appointmentType: "Follow-up",
        provider: "Dr. Retention",
        location: "Room RET",
        notes: "transcript retention test",
        priority: "medium",
        isVirtual: false
      })

    assert.equal(createdAppointment.status, 201)
    const encounterExternalId = createdAppointment.body.appointment.encounterId as string
    assert.ok(encounterExternalId)

    const startVisit = await request.post(`/api/encounters/${encounterExternalId}/start`).set(clinicianAuth).send({})
    assert.equal(startVisit.status, 200)

    const rawTranscript = "Call me at 555-123-4567 and email j.doe@example.com."
    const appendTranscript = await request
      .post(`/api/encounters/${encounterExternalId}/transcript/segments`)
      .set(clinicianAuth)
      .send({
        speaker: "Patient",
        text: rawTranscript,
        startMs: 0,
        endMs: 5000,
        confidence: 0.93
      })
    assert.equal(appendTranscript.status, 201)

    const noteContent = "ASSESSMENT:\nChest pain.\nPLAN:\nEKG."
    const saveNote = await request
      .post(`/api/encounters/${encounterExternalId}/note`)
      .set(clinicianAuth)
      .send({ content: noteContent })
    assert.equal(saveNote.status, 200)

    const compose = await request
      .post(`/api/wizard/${encounterExternalId}/compose`)
      .set(clinicianAuth)
      .send({ noteContent })
    assert.equal(compose.status, 200)

    const finalize = await request.post(`/api/wizard/${encounterExternalId}/finalize`).set(clinicianAuth).send({
      finalNote: compose.body.enhancedNote,
      finalPatientSummary: compose.body.patientSummary,
      attestClinicalAccuracy: true,
      attestBillingAccuracy: true
    })
    assert.equal(finalize.status, 200)

    const encounter = await adminPrisma.encounter.findFirst({
      where: { orgId, externalId: encounterExternalId }
    })
    assert.ok(encounter)

    const segmentsBefore = await adminPrisma.transcriptSegment.findMany({
      where: { orgId, encounterId: encounter!.id },
      orderBy: { createdAt: "asc" }
    })
    assert.equal(segmentsBefore.length > 0, true)

    const policyDryRun = await request
      .post("/api/admin/transcript-retention/enforce")
      .set(adminAuth)
      .send({ dryRun: true })
    assert.equal(policyDryRun.status, 200)
    assert.equal(typeof policyDryRun.body.report.retentionDays, "number")

    const retentionDays = policyDryRun.body.report.retentionDays as number

    if (retentionDays === 0) {
      // With retentionDays=0, finalize should have redacted transcript text immediately.
      assert.equal(
        segmentsBefore.every((segment) => segment.text === "[REDACTED]"),
        true
      )
    } else {
      // With retentionDays>0, redact should happen after finalizedAt is older than the cutoff.
      assert.equal(
        segmentsBefore.some((segment) => segment.text === rawTranscript),
        true
      )

      const dayMs = 24 * 60 * 60 * 1000
      await adminPrisma.encounter.updateMany({
        where: { id: encounter!.id, orgId },
        data: {
          finalizedAt: new Date(Date.now() - (retentionDays + 1) * dayMs)
        }
      })

      const policyApply = await request
        .post("/api/admin/transcript-retention/enforce")
        .set(adminAuth)
        .send({ dryRun: false })
      assert.equal(policyApply.status, 200)
      assert.ok(policyApply.body.report.redactedSegmentCount >= 1)

      const segmentsAfter = await adminPrisma.transcriptSegment.findMany({
        where: { orgId, encounterId: encounter!.id },
        orderBy: { createdAt: "asc" }
      })
      assert.equal(
        segmentsAfter.every((segment) => segment.text === "[REDACTED]"),
        true
      )
    }

    await clearTablesInOrder(adminPrisma)
    await adminPrisma.$disconnect()
  })
}
