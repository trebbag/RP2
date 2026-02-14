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
  test("integration flow (skipped)", { skip: true }, () => {
    assert.ok(true)
  })
} else {
  test("encounter flow: schedule -> visit -> wizard -> dispatch with artifact download", async () => {
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

    const login = await request.post("/api/auth/dev-login").send({
      email: "integration.clinician@revenuepilot.local",
      name: "Integration Clinician",
      role: "ADMIN"
    })

    assert.equal(login.status, 200)
    assert.ok(login.body.token)
    const auth = { Authorization: `Bearer ${login.body.token}` }

    const createdAppointment = await request
      .post("/api/appointments")
      .set(auth)
      .send({
        patientName: "Integration Patient",
        patientPhone: "(555) 000-0000",
        patientEmail: "integration.patient@example.com",
        appointmentTime: new Date(Date.now() + 60_000).toISOString(),
        duration: 30,
        appointmentType: "Follow-up",
        provider: "Dr. Integration",
        location: "Room INT",
        notes: "integration flow",
        priority: "medium",
        isVirtual: false
      })

    assert.equal(createdAppointment.status, 201)
    const encounterId = createdAppointment.body.appointment.encounterId as string
    const appointmentId = createdAppointment.body.appointment.id as string
    assert.ok(encounterId)

    const uploadFixturePath = path.resolve(process.cwd(), "tests", "fixtures", "charts", "text-chart.pdf")

    const uploadChart = await request
      .post(`/api/appointments/${appointmentId}/chart`)
      .set(auth)
      .attach("files", uploadFixturePath)
    assert.equal(uploadChart.status, 201)

    const processCharts = await request.post("/api/admin/chart-extraction/process").set(auth).send({ limit: 10 })
    assert.equal(processCharts.status, 200)

    const charts = await request.get(`/api/appointments/${appointmentId}/charts?includeText=1`).set(auth)

    assert.equal(charts.status, 200)
    assert.ok(Array.isArray(charts.body.charts))
    assert.ok(charts.body.charts.length >= 1)
    assert.equal(charts.body.charts[0].extractionJob.status, "SUCCEEDED")
    assert.ok((charts.body.charts[0].extractedText as string).includes("Medications:"))

    const startVisit = await request.post(`/api/encounters/${encounterId}/start`).set(auth).send({})
    assert.equal(startVisit.status, 200)

    const appendTranscript = await request.post(`/api/encounters/${encounterId}/transcript/segments`).set(auth).send({
      speaker: "Patient",
      text: "Cough has lasted two weeks and worsens with exertion.",
      startMs: 0,
      endMs: 6000,
      confidence: 0.97
    })
    assert.equal(appendTranscript.status, 201)

    const noteContent = `HISTORY OF PRESENT ILLNESS:\nPatient reports chest pain with exertion for two days.\n\nASSESSMENT:\nChest pain, rule out cardiac etiology.\n\nPLAN:\nOrder EKG and follow-up in one week.`

    const saveNote = await request.post(`/api/encounters/${encounterId}/note`).set(auth).send({ content: noteContent })
    assert.equal(saveNote.status, 200)

    const suggestions = await request
      .post(`/api/encounters/${encounterId}/suggestions/refresh`)
      .set(auth)
      .send({ trigger: "manual", noteContent })

    assert.equal(suggestions.status, 200)
    assert.ok(Array.isArray(suggestions.body.suggestions))
    assert.equal(typeof suggestions.body.promptVersionId, "string")

    const suggestionTraceArtifact = await adminPrisma.exportArtifact.findFirst({
      where: {
        encounter: { externalId: encounterId },
        type: "TRACE_JSON",
        fileName: "suggestions-trace.json"
      },
      orderBy: { createdAt: "desc" }
    })
    assert.ok(suggestionTraceArtifact)
    const suggestionTracePayload = JSON.parse(await fs.readFile(suggestionTraceArtifact!.filePath, "utf8")) as {
      promptVersionId?: string
      trace?: { promptVersionId?: string }
    }
    assert.equal(typeof suggestionTracePayload.promptVersionId, "string")
    assert.equal(suggestionTracePayload.promptVersionId, suggestions.body.promptVersionId)
    assert.equal(suggestionTracePayload.trace?.promptVersionId, suggestions.body.promptVersionId)

    const keepSelection = await request.post(`/api/wizard/${encounterId}/step/1/actions`).set(auth).send({
      actionType: "keep",
      code: "99213",
      codeType: "CPT",
      category: "CODE",
      reason: "Integration test keep"
    })

    assert.equal(keepSelection.status, 200)

    const compose = await request.post(`/api/wizard/${encounterId}/compose`).set(auth).send({ noteContent })

    assert.equal(compose.status, 200)
    assert.ok(compose.body.traceId)
    assert.equal(typeof compose.body.promptVersionId, "string")

    const composeTraceArtifact = await adminPrisma.exportArtifact.findFirst({
      where: {
        encounter: { externalId: encounterId },
        type: "TRACE_JSON",
        fileName: "compose-trace.json"
      },
      orderBy: { createdAt: "desc" }
    })
    assert.ok(composeTraceArtifact)
    const composeTracePayload = JSON.parse(await fs.readFile(composeTraceArtifact!.filePath, "utf8")) as {
      promptVersionId?: string
      orchestration?: { promptVersionId?: string }
    }
    assert.equal(typeof composeTracePayload.promptVersionId, "string")
    assert.equal(composeTracePayload.promptVersionId, compose.body.promptVersionId)
    assert.equal(composeTracePayload.orchestration?.promptVersionId, compose.body.promptVersionId)

    const wizardState = await request.get(`/api/wizard/${encounterId}/state`).set(auth)
    assert.equal(wizardState.status, 200)
    assert.ok(wizardState.body.state.latestComposeVersion)

    const billingPreview = await request
      .post(`/api/wizard/${encounterId}/billing-preview`)
      .set(auth)
      .send({ monthlyRevenueCents: 1_000_000, expectedCoderLiftPct: 0.03 })
    assert.equal(billingPreview.status, 200)
    assert.ok(typeof billingPreview.body.billing.estimatedChargeCents === "number")

    const compliance = await request.get(`/api/encounters/${encounterId}/compliance`).set(auth)
    assert.equal(compliance.status, 200)
    assert.equal(typeof compliance.body.promptVersionId, "string")

    const complianceTraceArtifact = await adminPrisma.exportArtifact.findFirst({
      where: {
        encounter: { externalId: encounterId },
        type: "TRACE_JSON",
        fileName: "compliance-trace.json"
      },
      orderBy: { createdAt: "desc" }
    })
    assert.ok(complianceTraceArtifact)
    const complianceTracePayload = JSON.parse(await fs.readFile(complianceTraceArtifact!.filePath, "utf8")) as {
      promptVersionId?: string
      trace?: { promptVersionId?: string }
    }
    assert.equal(typeof complianceTracePayload.promptVersionId, "string")
    assert.equal(complianceTracePayload.promptVersionId, compliance.body.promptVersionId)
    assert.equal(complianceTracePayload.trace?.promptVersionId, compliance.body.promptVersionId)

    const finalize = await request.post(`/api/wizard/${encounterId}/finalize`).set(auth).send({
      finalNote: compose.body.enhancedNote,
      finalPatientSummary: compose.body.patientSummary,
      attestClinicalAccuracy: true,
      attestBillingAccuracy: true
    })

    assert.equal(finalize.status, 200)
    assert.equal(finalize.body.status, "FINALIZED")
    assert.ok(Array.isArray(finalize.body.artifacts))
    assert.ok(finalize.body.artifacts.length >= 2)
    assert.ok(finalize.body.dispatch)
    assert.ok(["DISPATCHED", "RETRYING", "FAILED", "DEAD_LETTER", "PENDING"].includes(finalize.body.dispatch.status))

    for (const artifact of finalize.body.artifacts as Array<{ id: string; type: string }>) {
      const download = await request.get(`/api/exports/${artifact.id}`).set(auth)
      assert.equal(download.status, 200)
      assert.ok((download.headers["content-type"] as string).includes("application/pdf"))
      assert.ok(download.body || download.text || download.headers["content-length"])
    }

    const drafts = await request.get("/api/drafts").set(auth)
    assert.equal(drafts.status, 200)
    const finalizedDraft = drafts.body.drafts.find(
      (draft: { encounterId: string }) => draft.encounterId === encounterId
    )
    assert.ok(finalizedDraft)
    assert.equal(finalizedDraft.isFinal, true)

    await clearTablesInOrder(adminPrisma)
    await adminPrisma.$disconnect()
  })
}
