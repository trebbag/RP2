import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import test from "node:test"
import supertest from "supertest"

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"

const shouldRunIntegration = process.env.RP2_RUN_INTEGRATION === "1"
const integrationDbUrl = process.env.RP2_INTEGRATION_DB_URL || process.env.DATABASE_URL

function fromBase32(value: string): Buffer {
  const normalized = value.toUpperCase().replace(/=+$/g, "").replace(/[^A-Z2-7]/g, "")
  let bits = 0
  let buffer = 0
  const bytes: number[] = []

  for (const char of normalized) {
    const index = BASE32_ALPHABET.indexOf(char)
    if (index === -1) continue
    buffer = (buffer << 5) | index
    bits += 5
    if (bits >= 8) {
      bytes.push((buffer >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }

  return Buffer.from(bytes)
}

function generateTotp(secret: string, timeMs = Date.now(), stepSeconds = 30, digits = 6): string {
  const key = fromBase32(secret)
  const counter = Math.floor(timeMs / 1000 / stepSeconds)
  const counterBuffer = Buffer.alloc(8)
  counterBuffer.writeBigUInt64BE(BigInt(counter))

  const hmac = createHmac("sha1", key).update(counterBuffer).digest()
  const offset = hmac[hmac.length - 1] & 0x0f
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)

  const mod = 10 ** digits
  return (binary % mod).toString().padStart(digits, "0")
}

if (!shouldRunIntegration || !integrationDbUrl) {
  test("auth + MFA lifecycle integration (skipped)", { skip: true }, () => {
    assert.ok(true)
  })
} else {
  test("auth + MFA lifecycle integration", async () => {
    process.env.DATABASE_URL = integrationDbUrl
    process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-jwt-secret-1234567890"
    process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173"
    process.env.STORAGE_DIR = process.env.STORAGE_DIR || "./storage"

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
      await prisma.dispatchJob.deleteMany({})
      await prisma.note.deleteMany({})
      await prisma.encounter.deleteMany({})
      await prisma.chartAsset.deleteMany({})
      await prisma.appointment.deleteMany({})
      await prisma.patient.deleteMany({})
      await prisma.authSession.deleteMany({})
      await prisma.userSettings.deleteMany({})
      await prisma.user.deleteMany({})
    }

    await clearTablesInOrder()

    const bootstrapBefore = await request.get("/api/auth/bootstrap-status")
    assert.equal(bootstrapBefore.status, 200)
    assert.equal(bootstrapBefore.body.hasUsers, false)

    const adminEmail = "admin.mfa.integration@revenuepilot.local"
    const adminPassword = "PilotStrong!1234"

    const registerFirst = await request.post("/api/auth/register-first").send({
      email: adminEmail,
      name: "Integration Admin",
      password: adminPassword,
      role: "ADMIN"
    })

    assert.equal(registerFirst.status, 201)
    assert.equal(registerFirst.body.user.email, adminEmail)
    assert.equal(registerFirst.body.user.mfaEnabled, false)

    const bootstrapAfter = await request.get("/api/auth/bootstrap-status")
    assert.equal(bootstrapAfter.status, 200)
    assert.equal(bootstrapAfter.body.hasUsers, true)

    const adminAuth = {
      Authorization: `Bearer ${registerFirst.body.token as string}`
    }

    const mfaSetup = await request.post("/api/auth/mfa/setup").set(adminAuth).send({})
    assert.equal(mfaSetup.status, 200)
    const secret = mfaSetup.body.setup.secret as string
    assert.ok(secret.length >= 16)

    const mfaEnable = await request
      .post("/api/auth/mfa/enable")
      .set(adminAuth)
      .send({
        mfaCode: generateTotp(secret)
      })

    assert.equal(mfaEnable.status, 200)
    assert.equal(mfaEnable.body.enabled, true)
    assert.equal(Array.isArray(mfaEnable.body.backupCodes), true)
    assert.equal(mfaEnable.body.backupCodes.length, 8)

    const loginWithoutMfa = await request.post("/api/auth/login").send({
      email: adminEmail,
      password: adminPassword
    })
    assert.equal(loginWithoutMfa.status, 401)
    assert.equal(loginWithoutMfa.body.details?.mfaRequired, true)

    const validCode = generateTotp(secret)
    const invalidCode = validCode === "000000" ? "000001" : "000000"
    const loginWithInvalidMfa = await request.post("/api/auth/login").send({
      email: adminEmail,
      password: adminPassword,
      mfaCode: invalidCode
    })
    assert.equal(loginWithInvalidMfa.status, 401)
    assert.equal(loginWithInvalidMfa.body.details?.mfaRequired, true)

    const loginWithMfa = await request.post("/api/auth/login").send({
      email: adminEmail,
      password: adminPassword,
      mfaCode: generateTotp(secret)
    })
    assert.equal(loginWithMfa.status, 200)
    assert.ok(loginWithMfa.body.token)

    const mfaAuth = {
      Authorization: `Bearer ${loginWithMfa.body.token as string}`
    }

    const regenerateBackupCodes = await request
      .post("/api/auth/mfa/backup-codes/regenerate")
      .set(mfaAuth)
      .send({
        mfaCode: generateTotp(secret)
      })
    assert.equal(regenerateBackupCodes.status, 200)
    assert.equal(regenerateBackupCodes.body.backupCodes.length, 8)

    const backupCode = regenerateBackupCodes.body.backupCodes[0] as string
    const disableMfa = await request
      .post("/api/auth/mfa/disable")
      .set(mfaAuth)
      .send({
        backupCode
      })
    assert.equal(disableMfa.status, 200)
    assert.equal(disableMfa.body.enabled, false)

    const loginAfterDisable = await request.post("/api/auth/login").send({
      email: adminEmail,
      password: adminPassword
    })
    assert.equal(loginAfterDisable.status, 200)

    const postDisableAuth = {
      Authorization: `Bearer ${loginAfterDisable.body.token as string}`
    }

    const clinicianEmail = "clinician.mfa.integration@revenuepilot.local"
    const clinicianPassword = "ClinicianStrong!1234"
    const registerClinician = await request.post("/api/auth/register").set(postDisableAuth).send({
      email: clinicianEmail,
      name: "Integration Clinician",
      password: clinicianPassword,
      role: "CLINICIAN"
    })
    assert.equal(registerClinician.status, 201)

    const clinician = await prisma.user.findUnique({ where: { email: clinicianEmail } })
    assert.ok(clinician)

    await prisma.user.update({
      where: { id: clinician!.id },
      data: {
        mfaEnabled: true,
        mfaSecret: "ABCDEFGHIJKLMNOPQRSTUVWXYZ123456",
        mfaBackupCodesHash: [] as never,
        mfaEnrolledAt: new Date()
      }
    })

    const adminUsers = await request.get("/api/admin/users").set(postDisableAuth)
    assert.equal(adminUsers.status, 200)
    assert.ok(adminUsers.body.users.some((user: { email: string }) => user.email === clinicianEmail))

    const resetClinicianMfa = await request
      .post(`/api/admin/users/${clinician!.id}/mfa/reset`)
      .set(postDisableAuth)
      .send({
        reason: "Integration validation for admin MFA recovery."
      })
    assert.equal(resetClinicianMfa.status, 200)
    assert.equal(resetClinicianMfa.body.user.mfaEnabled, false)

    const clinicianLogin = await request.post("/api/auth/login").send({
      email: clinicianEmail,
      password: clinicianPassword
    })
    assert.equal(clinicianLogin.status, 200)

    const clinicianAuth = {
      Authorization: `Bearer ${clinicianLogin.body.token as string}`
    }
    const clinicianCannotResetAdmin = await request
      .post(`/api/admin/users/${registerFirst.body.user.id as string}/mfa/reset`)
      .set(clinicianAuth)
      .send({
        reason: "Unauthorized reset attempt."
      })
    assert.equal(clinicianCannotResetAdmin.status, 403)

    await clearTablesInOrder()
    await prisma.$disconnect()
  })
}
