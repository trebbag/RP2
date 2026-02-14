import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import supertest from "supertest"
import { clearTablesInOrder, createAdminPrisma, resolveIntegrationAdminDbUrl } from "./helpers/adminDb.js"

const shouldRunIntegration = process.env.RP2_RUN_INTEGRATION === "1"
const integrationDbUrl = process.env.RP2_INTEGRATION_DB_URL || process.env.DATABASE_URL
const integrationAdminDbUrl = resolveIntegrationAdminDbUrl()

if (!shouldRunIntegration || !integrationDbUrl || !integrationAdminDbUrl) {
  test("role matrix + audit retention integration (skipped)", { skip: true }, () => {
    assert.ok(true)
  })
} else {
  test("role matrix enforcement and audit retention policy checks", async () => {
    process.env.DATABASE_URL = integrationDbUrl
    process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-jwt-secret-1234567890"
    process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173"
    process.env.STORAGE_DIR = process.env.STORAGE_DIR || "./storage"
    process.env.AUDIT_RETENTION_DAYS = process.env.AUDIT_RETENTION_DAYS || "30"

    const { createApp } = await import("../src/app.js")
    const adminPrisma = createAdminPrisma()

    const app = createApp()
    const request = supertest(app)

    await adminPrisma.$connect()
    await clearTablesInOrder(adminPrisma)

    const login = async (role: "ADMIN" | "MA" | "CLINICIAN", email: string) => {
      const response = await request.post("/api/auth/dev-login").send({
        email,
        name: `${role} User`,
        role
      })
      assert.equal(response.status, 200)
      return {
        headers: { Authorization: `Bearer ${response.body.token}` },
        orgId: response.body.user.orgId as string
      }
    }

    const clinicianLogin = await login("CLINICIAN", "integration.clinician@revenuepilot.local")
    const maLogin = await login("MA", "integration.ma@revenuepilot.local")
    const adminLogin = await login("ADMIN", "integration.admin@revenuepilot.local")
    const clinicianAuth = clinicianLogin.headers
    const maAuth = maLogin.headers
    const adminAuth = adminLogin.headers
    const orgId = clinicianLogin.orgId
    const clinicianUser = await adminPrisma.user.findUnique({
      where: { email: "integration.clinician@revenuepilot.local" }
    })
    assert.ok(clinicianUser)

    const createAppointmentBody = {
      patientName: "Role Matrix Patient",
      patientPhone: "(555) 111-1111",
      patientEmail: "role.patient@example.com",
      appointmentTime: new Date(Date.now() + 120_000).toISOString(),
      duration: 30,
      appointmentType: "Follow-up",
      provider: "Dr. Matrix",
      location: "Room R1",
      notes: "role matrix test",
      priority: "medium",
      isVirtual: false
    }

    const createdByClinician = await request.post("/api/appointments").set(clinicianAuth).send(createAppointmentBody)
    assert.equal(createdByClinician.status, 201)
    const encounterId = createdByClinician.body.appointment.encounterId as string
    const appointmentId = createdByClinician.body.appointment.id as string

    const createdByMa = await request
      .post("/api/appointments")
      .set(maAuth)
      .send({
        ...createAppointmentBody,
        patientName: "MA Created Patient",
        patientEmail: "ma.patient@example.com"
      })
    assert.equal(createdByMa.status, 201)

    const maStartForbidden = await request.post(`/api/encounters/${encounterId}/start`).set(maAuth).send({})
    assert.equal(maStartForbidden.status, 403)

    const clinicianStart = await request.post(`/api/encounters/${encounterId}/start`).set(clinicianAuth).send({})
    assert.equal(clinicianStart.status, 200)

    const maTranscriptStreamForbidden = await request
      .get(`/api/encounters/${encounterId}/transcript/stream`)
      .set(maAuth)
    assert.equal(maTranscriptStreamForbidden.status, 403)

    const uploadFixturePath = path.resolve(os.tmpdir(), `rp2-role-${Date.now()}.txt`)
    await fs.writeFile(
      uploadFixturePath,
      [
        "Medications: Aspirin 81mg; Lisinopril 10mg",
        "Allergies: Penicillin",
        "PMH: Hypertension, Diabetes",
        "BP: 132/84",
        "HR: 78",
        "Lab: A1c=7.2 % H"
      ].join("\n"),
      "utf8"
    )

    const maUpload = await request
      .post(`/api/appointments/${appointmentId}/chart`)
      .set(maAuth)
      .attach("files", uploadFixturePath)
    assert.equal(maUpload.status, 201)
    await fs.rm(uploadFixturePath, { force: true })

    const maComposeForbidden = await request.post(`/api/wizard/${encounterId}/compose`).set(maAuth).send({})
    assert.equal(maComposeForbidden.status, 403)

    const draftsVisibleToMa = await request.get("/api/drafts").set(maAuth)
    assert.equal(draftsVisibleToMa.status, 200)

    const settingsGet = await request.get("/api/settings/me").set(clinicianAuth)
    assert.equal(settingsGet.status, 200)
    assert.equal(settingsGet.body.settings.suggestions.codes, true)

    const settingsPut = await request
      .put("/api/settings/me")
      .set(clinicianAuth)
      .send({
        settings: {
          ...settingsGet.body.settings,
          suggestions: {
            ...settingsGet.body.settings.suggestions,
            publicHealth: true
          }
        }
      })
    assert.equal(settingsPut.status, 200)
    assert.equal(settingsPut.body.settings.suggestions.publicHealth, true)

    const clinicianActivity = await request.get("/api/activity").set(clinicianAuth)
    assert.equal(clinicianActivity.status, 200)
    assert.ok(Array.isArray(clinicianActivity.body.activities))
    assert.equal(typeof clinicianActivity.body.pageInfo.hasMore, "boolean")
    assert.equal(typeof clinicianActivity.body.pageInfo.returned, "number")

    const clinicianActivityWithBackendFlag = await request.get("/api/activity?includeBackend=true").set(clinicianAuth)
    assert.equal(clinicianActivityWithBackendFlag.status, 200)
    assert.equal(
      clinicianActivityWithBackendFlag.body.activities.some(
        (entry: { category: string }) => entry.category === "backend"
      ),
      false
    )

    await adminPrisma.auditLog.createMany({
      data: [
        {
          orgId,
          actorId: clinicianUser!.id,
          action: "auth_login_failed",
          entity: "auth",
          entityId: "auth-filter-seed",
          createdAt: new Date(Date.now() - 10_000)
        },
        {
          orgId,
          actorId: clinicianUser!.id,
          action: "settings_update",
          entity: "user_settings",
          entityId: "settings-filter-seed",
          createdAt: new Date(Date.now() - 9_000)
        },
        {
          orgId,
          action: "dispatch_failed_terminal",
          entity: "dispatch_job",
          entityId: "dispatch-filter-seed",
          createdAt: new Date(Date.now() - 8_000)
        }
      ]
    })

    const clinicianAuthErrors = await request
      .get("/api/activity?category=auth&severity=error&limit=10")
      .set(clinicianAuth)
    assert.equal(clinicianAuthErrors.status, 200)
    assert.ok(
      clinicianAuthErrors.body.activities.every(
        (entry: { category: string; severity: string }) => entry.category === "auth" && entry.severity === "error"
      )
    )

    const adminWithoutBackend = await request.get("/api/activity?limit=50").set(adminAuth)
    assert.equal(adminWithoutBackend.status, 200)
    assert.equal(
      adminWithoutBackend.body.activities.some((entry: { category: string }) => entry.category === "backend"),
      false
    )

    const adminActivity = await request.get("/api/activity?includeBackend=true").set(adminAuth)
    assert.equal(adminActivity.status, 200)
    assert.ok(Array.isArray(adminActivity.body.activities))
    assert.equal(
      adminActivity.body.activities.some((entry: { category: string }) => entry.category === "backend"),
      true
    )

    const adminPagedFirst = await request.get("/api/activity?limit=1&includeBackend=true").set(adminAuth)
    assert.equal(adminPagedFirst.status, 200)
    assert.equal(adminPagedFirst.body.activities.length, 1)
    assert.equal(typeof adminPagedFirst.body.pageInfo.nextCursor, "string")

    const adminPagedSecond = await request
      .get(
        `/api/activity?limit=1&includeBackend=true&cursor=${encodeURIComponent(adminPagedFirst.body.pageInfo.nextCursor)}`
      )
      .set(adminAuth)
    assert.equal(adminPagedSecond.status, 200)
    if (adminPagedSecond.body.activities.length > 0) {
      assert.notEqual(adminPagedFirst.body.activities[0].id, adminPagedSecond.body.activities[0].id)
    }

    await adminPrisma.auditLog.createMany({
      data: [
        {
          orgId,
          action: "manual_seed",
          entity: "audit",
          entityId: "old-record",
          createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000)
        },
        {
          orgId,
          action: "manual_seed",
          entity: "audit",
          entityId: "recent-record",
          createdAt: new Date()
        }
      ]
    })

    const retentionDryRun = await request
      .post("/api/admin/audit-retention/enforce")
      .set(adminAuth)
      .send({ dryRun: true })
    assert.equal(retentionDryRun.status, 200)
    assert.equal(retentionDryRun.body.report.dryRun, true)
    assert.ok(retentionDryRun.body.report.eligibleCount >= 1)

    const retentionApply = await request
      .post("/api/admin/audit-retention/enforce")
      .set(adminAuth)
      .send({ dryRun: false })
    assert.equal(retentionApply.status, 200)
    assert.equal(retentionApply.body.report.dryRun, false)
    assert.ok(retentionApply.body.report.deletedCount >= 1)

    const maAdminEndpointForbidden = await request
      .post("/api/admin/audit-retention/enforce")
      .set(maAuth)
      .send({ dryRun: true })
    assert.equal(maAdminEndpointForbidden.status, 403)

    const dispatchRetry = await request.post("/api/admin/dispatch/retry-due").set(adminAuth).send({ limit: 10 })
    assert.equal(dispatchRetry.status, 200)
    assert.ok(Array.isArray(dispatchRetry.body.processed))

    const dispatchList = await request.get("/api/admin/dispatch/jobs").set(adminAuth)
    assert.equal(dispatchList.status, 200)
    assert.ok(Array.isArray(dispatchList.body.jobs))

    const dispatchListForbidden = await request.get("/api/admin/dispatch/jobs").set(maAuth)
    assert.equal(dispatchListForbidden.status, 403)

    const contractValidation = await request.post("/api/admin/dispatch/contract/validate").set(adminAuth).send({
      target: "FHIR_R4"
    })
    assert.equal(contractValidation.status, 200)
    assert.equal(typeof contractValidation.body.validation.ok, "boolean")

    const contractValidationForbidden = await request.post("/api/admin/dispatch/contract/validate").set(maAuth).send({
      target: "FHIR_R4"
    })
    assert.equal(contractValidationForbidden.status, 403)

    const sandboxReadiness = await request.get("/api/admin/dispatch/sandbox-readiness").set(adminAuth)
    assert.equal(sandboxReadiness.status, 200)
    assert.equal(typeof sandboxReadiness.body.readiness.ready, "boolean")

    const sandboxReadinessForbidden = await request.get("/api/admin/dispatch/sandbox-readiness").set(maAuth)
    assert.equal(sandboxReadinessForbidden.status, 403)

    const billingPackAdmin = await request.get("/api/admin/billing/fee-schedules").set(adminAuth)
    assert.equal(billingPackAdmin.status, 200)
    assert.equal(typeof billingPackAdmin.body.pack.packVersion, "string")

    const billingPackForbidden = await request.get("/api/admin/billing/fee-schedules").set(maAuth)
    assert.equal(billingPackForbidden.status, 403)

    const observabilitySummary = await request.get("/api/admin/observability/summary").set(adminAuth)
    assert.equal(observabilitySummary.status, 200)
    assert.equal(typeof observabilitySummary.body.summary.alerts.dlqThresholdBreached, "boolean")
    assert.equal(typeof observabilitySummary.body.summary.aiQuality.suggestions.acceptanceRate, "number")
    assert.equal(typeof observabilitySummary.body.summary.aiQuality.transcript.correctionRate, "number")
    assert.equal(typeof observabilitySummary.body.summary.aiQuality.compliance.falsePositiveRate, "number")
    assert.equal(typeof observabilitySummary.body.summary.alerts.suggestionAcceptanceLow, "boolean")
    assert.equal(typeof observabilitySummary.body.summary.alerts.transcriptCorrectionHigh, "boolean")
    assert.equal(typeof observabilitySummary.body.summary.alerts.complianceFalsePositiveHigh, "boolean")

    const observabilitySummaryForbidden = await request.get("/api/admin/observability/summary").set(maAuth)
    assert.equal(observabilitySummaryForbidden.status, 403)

    const observabilityTrends = await request
      .get("/api/admin/observability/trends?windowMinutes=180&bucketMinutes=60")
      .set(adminAuth)
    assert.equal(observabilityTrends.status, 200)
    assert.ok(Array.isArray(observabilityTrends.body.trends.points))
    assert.equal(typeof observabilityTrends.body.trends.bucketMinutes, "number")
    if (observabilityTrends.body.trends.points.length > 0) {
      const firstPoint = observabilityTrends.body.trends.points[0]
      assert.equal(typeof firstPoint.stt.fallbackRate, "number")
      assert.equal(typeof firstPoint.aiQuality.suggestions.acceptanceRate, "number")
      assert.equal(typeof firstPoint.aiQuality.transcript.correctionRate, "number")
      assert.equal(typeof firstPoint.aiQuality.compliance.falsePositiveRate, "number")
    }

    const observabilityTrendsForbidden = await request.get("/api/admin/observability/trends").set(maAuth)
    assert.equal(observabilityTrendsForbidden.status, 403)

    const secretRotationRecord = await request
      .post("/api/admin/security/secret-rotation/record")
      .set(adminAuth)
      .send({
        ticketId: "SEC-ROLEMATRIX-1",
        secrets: ["JWT_SECRET"],
        notes: "Role matrix integration check"
      })
    assert.equal(secretRotationRecord.status, 201)

    const secretRotationStatus = await request.get("/api/admin/security/secret-rotation/status").set(adminAuth)
    assert.equal(secretRotationStatus.status, 200)
    assert.equal(secretRotationStatus.body.status.hasRecordedRotation, true)

    const secretRotationForbidden = await request.get("/api/admin/security/secret-rotation/status").set(maAuth)
    assert.equal(secretRotationForbidden.status, 403)

    const adminUsers = await request.get("/api/admin/users").set(adminAuth)
    assert.equal(adminUsers.status, 200)
    assert.ok(Array.isArray(adminUsers.body.users))

    const adminUsersForbidden = await request.get("/api/admin/users").set(maAuth)
    assert.equal(adminUsersForbidden.status, 403)
    await adminPrisma.user.update({
      where: { id: clinicianUser!.id },
      data: {
        mfaEnabled: true,
        mfaSecret: "TESTSECRET",
        mfaBackupCodesHash: [] as never,
        mfaEnrolledAt: new Date()
      }
    })

    const mfaReset = await request
      .post(`/api/admin/users/${clinicianUser!.id}/mfa/reset`)
      .set(adminAuth)
      .send({ reason: "Account recovery test during integration suite." })
    assert.equal(mfaReset.status, 200)
    assert.equal(mfaReset.body.user.mfaEnabled, false)

    const remainingOld = await adminPrisma.auditLog.findMany({
      where: {
        orgId,
        entityId: {
          in: ["old-record", "recent-record"]
        }
      }
    })

    assert.equal(
      remainingOld.some((row) => row.entityId === "old-record"),
      false
    )
    assert.equal(
      remainingOld.some((row) => row.entityId === "recent-record"),
      true
    )

    await clearTablesInOrder(adminPrisma)
    await adminPrisma.$disconnect()
  })
}
