import assert from "node:assert/strict"
import test from "node:test"
import supertest from "supertest"

const shouldRunIntegration = process.env.RP2_RUN_INTEGRATION === "1"
const integrationDbUrl = process.env.RP2_INTEGRATION_DB_URL || process.env.DATABASE_URL

if (!shouldRunIntegration || !integrationDbUrl) {
  test("security controls integration (skipped)", { skip: true }, () => {
    assert.ok(true)
  })
} else {
  test("security controls: auth rate-limit and secret-rotation operations", async () => {
    process.env.DATABASE_URL = integrationDbUrl
    process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-jwt-secret-1234567890"
    process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173"
    process.env.STORAGE_DIR = process.env.STORAGE_DIR || "./storage"
    process.env.AUTH_LOGIN_WINDOW_SECONDS = "300"
    process.env.AUTH_LOGIN_MAX_ATTEMPTS = "2"
    process.env.AUTH_LOGIN_BLOCK_SECONDS = "300"

    const { createApp } = await import("../src/app.js")
    const { prisma } = await import("../src/lib/prisma.js")

    const app = createApp()
    const request = supertest(app)

    await prisma.$connect()

    const clearTablesInOrder = async () => {
      await prisma.auditLog.deleteMany({})
      await prisma.authSession.deleteMany({})
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
      await prisma.dispatchJob.deleteMany({})
      await prisma.encounter.deleteMany({})
      await prisma.chartAsset.deleteMany({})
      await prisma.appointment.deleteMany({})
      await prisma.patient.deleteMany({})
      await prisma.userSettings.deleteMany({})
      await prisma.user.deleteMany({})
    }

    await clearTablesInOrder()

    const register = await request.post("/api/auth/register-first").send({
      email: "security.admin@revenuepilot.local",
      name: "Security Admin",
      password: "PilotSecure#12345",
      role: "ADMIN"
    })

    assert.equal(register.status, 201)
    assert.ok(register.body.token)

    const wrongLogin1 = await request.post("/api/auth/login").send({
      email: "security.admin@revenuepilot.local",
      password: "WrongPassword#1"
    })
    assert.equal(wrongLogin1.status, 401)

    const wrongLogin2 = await request.post("/api/auth/login").send({
      email: "security.admin@revenuepilot.local",
      password: "WrongPassword#2"
    })
    assert.equal(wrongLogin2.status, 401)

    const wrongLogin3 = await request.post("/api/auth/login").send({
      email: "security.admin@revenuepilot.local",
      password: "WrongPassword#3"
    })
    assert.equal(wrongLogin3.status, 429)
    assert.ok(typeof wrongLogin3.headers["retry-after"] === "string")

    const auth = { Authorization: `Bearer ${register.body.token}` }

    const recordRotation = await request
      .post("/api/admin/security/secret-rotation/record")
      .set(auth)
      .send({
        ticketId: "SEC-1234",
        secrets: ["JWT_SECRET", "OPENAI_API_KEY"],
        notes: "Routine quarterly rotation"
      })

    assert.equal(recordRotation.status, 201)
    assert.equal(recordRotation.body.rotation.ticketId, "SEC-1234")

    const rotationStatus = await request
      .get("/api/admin/security/secret-rotation/status")
      .set(auth)

    assert.equal(rotationStatus.status, 200)
    assert.equal(rotationStatus.body.status.hasRecordedRotation, true)
    assert.ok(Array.isArray(rotationStatus.body.status.secretsTracked))
    assert.ok(rotationStatus.body.status.secretsTracked.some((item: { secret: string }) => item.secret === "JWT_SECRET"))

    await clearTablesInOrder()
    await prisma.$disconnect()
  })
}
