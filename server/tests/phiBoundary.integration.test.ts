import assert from "node:assert/strict"
import test from "node:test"
import supertest from "supertest"

const shouldRunIntegration = process.env.RP2_RUN_INTEGRATION === "1"
const integrationDbUrl = process.env.RP2_INTEGRATION_DB_URL || process.env.DATABASE_URL

if (!shouldRunIntegration || !integrationDbUrl) {
  test("phi boundary integration (skipped)", { skip: true }, () => {
    assert.ok(true)
  })
} else {
  test("compose endpoint rejects unknown PHI fields and does not echo values", async () => {
    process.env.DATABASE_URL = integrationDbUrl
    process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-jwt-secret-1234567890"
    process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173"
    process.env.STORAGE_DIR = process.env.STORAGE_DIR || "./storage"
    process.env.RP2_OFFLINE_AI = process.env.RP2_OFFLINE_AI || "1"

    const { createApp } = await import("../src/app.js")
    const { prisma } = await import("../src/lib/prisma.js")

    const app = createApp()
    const request = supertest(app)

    await prisma.$connect()

    const clearTablesInOrder = async () => {
      await prisma.auditLog.deleteMany({})
      await prisma.exportArtifact.deleteMany({})
      await prisma.wizardStepState.deleteMany({})
      await prisma.wizardRun.deleteMany({})
      await prisma.complianceIssue.deleteMany({})
      await prisma.codeSelection.deleteMany({})
      await prisma.codeSuggestion.deleteMany({})
      await prisma.suggestionGeneration.deleteMany({})
      await prisma.transcriptSegment.deleteMany({})
      await prisma.noteVersion.deleteMany({})
      await prisma.note.deleteMany({})
      await prisma.encounter.deleteMany({})
      await prisma.chartAsset.deleteMany({})
      await prisma.appointment.deleteMany({})
      await prisma.patient.deleteMany({})
      await prisma.user.deleteMany({})
    }

    await clearTablesInOrder()

    const login = await request.post("/api/auth/dev-login").send({
      email: "phi.boundary.clinician@revenuepilot.local",
      name: "PHI Boundary Clinician",
      role: "CLINICIAN"
    })
    assert.equal(login.status, 200)
    const auth = { Authorization: `Bearer ${login.body.token}` }

    const createdAppointment = await request
      .post("/api/appointments")
      .set(auth)
      .send({
        patientName: "Boundary Test Patient",
        patientPhone: "(555) 000-4444",
        patientEmail: "boundary.patient@example.com",
        appointmentTime: new Date(Date.now() + 120_000).toISOString(),
        duration: 30,
        appointmentType: "Follow-up",
        provider: "Dr. Boundary",
        location: "Room 10",
        notes: "phi boundary test",
        priority: "medium",
        isVirtual: false
      })
    assert.equal(createdAppointment.status, 201)
    const encounterId = createdAppointment.body.appointment.encounterId as string

    const compose = await request
      .post(`/api/wizard/${encounterId}/compose`)
      .set(auth)
      .send({
        noteContent: "ASSESSMENT:\nStable.\nPLAN:\nFollow up.",
        patientName: "Should Be Rejected"
      })

    assert.equal(compose.status, 400)
    assert.equal(compose.body.error, "Validation error")
    assert.equal(JSON.stringify(compose.body).includes("Should Be Rejected"), false)

    await clearTablesInOrder()
    await prisma.$disconnect()
  })
}
