import assert from "node:assert/strict"
import test from "node:test"
import supertest from "supertest"
import { clearTablesInOrder, createAdminPrisma, resolveIntegrationAdminDbUrl } from "./helpers/adminDb.js"

const shouldRunSoak = process.env.RP2_RUN_SOAK === "1"
const integrationDbUrl = process.env.RP2_INTEGRATION_DB_URL || process.env.DATABASE_URL
const integrationAdminDbUrl = resolveIntegrationAdminDbUrl()

if (!shouldRunSoak || !integrationDbUrl || !integrationAdminDbUrl) {
  test("soak tests (skipped)", { skip: true }, () => {
    assert.ok(true)
  })
} else {
  test("soak: long transcript session quality endpoint and dispatch retry storm", async () => {
    process.env.DATABASE_URL = integrationDbUrl
    process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-jwt-secret-1234567890"
    process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173"
    process.env.STORAGE_DIR = process.env.STORAGE_DIR || "./storage"
    process.env.DISPATCH_TARGET = "VENDOR_API"
    process.env.DISPATCH_WEBHOOK_URL = "http://127.0.0.1:65532/dispatch-fail"
    process.env.DISPATCH_MAX_ATTEMPTS = "2"
    process.env.DISPATCH_BACKOFF_MS = "1"

    const { createApp } = await import("../src/app.js")
    const adminPrisma = createAdminPrisma()
    const { enqueueDispatchJob, processDueDispatchJobs } = await import("../src/services/dispatchService.js")

    const app = createApp()
    const request = supertest(app)

    await adminPrisma.$connect()
    await clearTablesInOrder(adminPrisma)

    const login = await request.post("/api/auth/dev-login").send({
      email: "soak.clinician@revenuepilot.local",
      name: "Soak Clinician",
      role: "CLINICIAN"
    })
    assert.equal(login.status, 200)
    const auth = { Authorization: `Bearer ${login.body.token}` }
    const orgId = login.body.user.orgId as string

    const createdAppointment = await request
      .post("/api/appointments")
      .set(auth)
      .send({
        patientName: "Soak Patient",
        patientPhone: "(555) 222-2222",
        patientEmail: "soak.patient@example.com",
        appointmentTime: new Date(Date.now() + 60_000).toISOString(),
        duration: 45,
        appointmentType: "Follow-up",
        provider: "Dr. Soak",
        location: "Room Soak",
        notes: "soak test",
        priority: "medium",
        isVirtual: false
      })
    assert.equal(createdAppointment.status, 201)

    const encounterId = createdAppointment.body.appointment.encounterId as string
    const encounter = await adminPrisma.encounter.findFirst({
      where: {
        orgId,
        OR: [{ externalId: encounterId }, { id: encounterId }]
      },
      include: { note: true, patient: true, provider: true }
    })
    assert.ok(encounter)
    assert.ok(encounter?.note)

    // Long-session transcript load simulation: 1,000 segments.
    const transcriptRows = Array.from({ length: 1000 }).map((_, index) => ({
      orgId,
      encounterId: encounter!.id,
      speaker: index % 2 === 0 ? "Doctor" : "Patient",
      text: `Soak transcript line ${index + 1}`,
      startMs: index * 1200,
      endMs: index * 1200 + 1000,
      confidence: 0.85
    }))

    await adminPrisma.transcriptSegment.createMany({
      data: transcriptRows
    })

    const quality = await request.get(`/api/encounters/${encounterId}/transcript/quality`).set(auth)
    assert.equal(quality.status, 200)
    assert.ok(quality.body.report)
    // Endpoint intentionally caps analysis window to newest 500 segments.
    assert.equal(quality.body.report.metrics.segmentCount, 500)

    const payload = {
      encounterExternalId: encounter!.externalId,
      patientExternalId: encounter!.patient.externalId,
      providerName: encounter!.provider?.name ?? "Dr. Soak",
      noteContent: "Dispatch soak note",
      patientSummary: "Dispatch soak summary",
      billing: {
        payerModel: "MEDICARE",
        selectedCptCodes: ["99213"],
        estimatedChargeCents: 10000,
        expectedReimbursementCents: 8000
      },
      artifacts: []
    }

    for (let index = 0; index < 15; index += 1) {
      await enqueueDispatchJob({
        orgId,
        encounterId: encounter!.id,
        noteId: encounter!.note!.id,
        payload
      })
    }

    for (let cycle = 0; cycle < 6; cycle += 1) {
      await processDueDispatchJobs(100, orgId)
      await new Promise((resolve) => setTimeout(resolve, 5))
      await adminPrisma.dispatchJob.updateMany({
        where: { status: "RETRYING", orgId },
        data: { nextRetryAt: new Date(Date.now() - 1000) }
      })
    }

    const totals = await adminPrisma.dispatchJob.groupBy({
      where: { orgId },
      by: ["status"],
      _count: { _all: true }
    })
    const deadLetterCount = totals.find((row) => row.status === "DEAD_LETTER")?._count._all ?? 0
    assert.ok(deadLetterCount >= 10)

    await clearTablesInOrder(adminPrisma)
    await adminPrisma.$disconnect()
  })
}
