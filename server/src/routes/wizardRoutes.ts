import path from "node:path"
import { Router } from "express"
import { z } from "zod"
import { ArtifactType, SuggestionCategory, WizardStep, WizardStepStatus } from "@prisma/client"
import { prisma } from "../lib/prisma.js"
import { ApiError } from "../middleware/errorHandler.js"
import type { AuthenticatedRequest } from "../types.js"
import { composeNoteOrchestrated } from "../services/composeService.js"
import { env } from "../config/env.js"
import { sseHub } from "../lib/sseHub.js"
import { createPdfArtifact } from "../services/pdfService.js"
import { calculateBillingEstimate, formatUsd } from "../services/billingService.js"
import { attemptDispatchJob, enqueueDispatchJob } from "../services/dispatchService.js"
import { writeAuditLog } from "../middleware/audit.js"
import { persistTraceJson } from "../services/traceService.js"
import { requireRole } from "../middleware/auth.js"
import { loadPromptProfileForUser } from "../services/promptBuilderService.js"

const stepActionSchema = z.object({
  actionType: z.enum(["keep", "remove", "move_to_diagnosis", "move_to_differential", "add_from_suggestion"]),
  suggestionId: z.string().optional(),
  code: z.string().optional(),
  codeType: z.string().optional(),
  category: z.enum(["CODE", "DIAGNOSIS", "DIFFERENTIAL", "PREVENTION"]).optional(),
  reason: z.string().optional(),
  payload: z.record(z.string(), z.unknown()).optional()
})

const composeSchema = z
  .object({
    noteContent: z.string().optional(),
  })
  .strict()

const finalizeSchema = z.object({
  finalNote: z.string().optional(),
  finalPatientSummary: z.string().optional(),
  attestClinicalAccuracy: z.boolean(),
  attestBillingAccuracy: z.boolean(),
  payerModel: z.string().optional(),
  monthlyRevenueCents: z.number().int().positive().optional(),
  expectedCoderLiftPct: z.number().min(0).max(1).optional(),
  deductibleRemainingCents: z.number().int().nonnegative().optional(),
  coinsurancePct: z.number().min(0).max(1).optional(),
  copayCents: z.number().int().nonnegative().optional()
})

const billingPreviewSchema = z.object({
  payerModel: z.string().optional(),
  monthlyRevenueCents: z.number().int().positive().optional(),
  expectedCoderLiftPct: z.number().min(0).max(1).optional(),
  deductibleRemainingCents: z.number().int().nonnegative().optional(),
  coinsurancePct: z.number().min(0).max(1).optional(),
  copayCents: z.number().int().nonnegative().optional()
})

const STEP_MAP: Record<number, WizardStep> = {
  1: WizardStep.STEP1_CODE_REVIEW,
  2: WizardStep.STEP2_SUGGESTION_REVIEW,
  3: WizardStep.STEP3_COMPOSE,
  4: WizardStep.STEP4_COMPARE_EDIT,
  5: WizardStep.STEP5_BILLING_ATTEST,
  6: WizardStep.STEP6_SIGN_DISPATCH
}

function mapActionToSelection(actionType: z.infer<typeof stepActionSchema>["actionType"]) {
  switch (actionType) {
    case "keep":
      return "KEEP"
    case "remove":
      return "REMOVE"
    case "move_to_diagnosis":
      return "MOVE_TO_DIAGNOSIS"
    case "move_to_differential":
      return "MOVE_TO_DIFFERENTIAL"
    case "add_from_suggestion":
      return "ADD_FROM_SUGGESTION"
    default:
      return "KEEP"
  }
}

async function resolveEncounter(encounterIdentifier: string) {
  return prisma.encounter.findFirst({
    where: {
      OR: [{ id: encounterIdentifier }, { externalId: encounterIdentifier }]
    },
    include: {
      note: true,
      patient: true,
      provider: true
    }
  })
}

async function getOrCreateWizardRun(encounterId: string) {
  const latest = await prisma.wizardRun.findFirst({
    where: {
      encounterId,
      status: "IN_PROGRESS"
    },
    orderBy: { startedAt: "desc" }
  })

  if (latest) return latest

  return prisma.wizardRun.create({
    data: {
      encounterId,
      status: "IN_PROGRESS"
    }
  })
}

async function resolvePromptProfile(req: AuthenticatedRequest) {
  return loadPromptProfileForUser(req.user.id)
}

async function upsertStepState(params: {
  wizardRunId: string
  encounterId: string
  step: WizardStep
  status: WizardStepStatus
  payload: Record<string, unknown>
  actorId: string
}) {
  return prisma.wizardStepState.upsert({
    where: {
      wizardRunId_step: {
        wizardRunId: params.wizardRunId,
        step: params.step
      }
    },
    update: {
      status: params.status,
      payload: params.payload as never,
      lastActorId: params.actorId
    },
    create: {
      wizardRunId: params.wizardRunId,
      encounterId: params.encounterId,
      step: params.step,
      status: params.status,
      payload: params.payload as never,
      lastActorId: params.actorId
    }
  })
}

async function getSelectedCodes(encounterId: string): Promise<string[]> {
  const selections = await prisma.codeSelection.findMany({
    where: { encounterId },
    orderBy: { createdAt: "asc" }
  })

  const activeCodes = new Map<string, true>()
  for (const selection of selections) {
    if (selection.action === "REMOVE") {
      activeCodes.delete(selection.code)
    } else {
      activeCodes.set(selection.code, true)
    }
  }

  return Array.from(activeCodes.keys())
}

async function getLatestDecisions(encounterId: string) {
  const selections = await prisma.codeSelection.findMany({
    where: { encounterId },
    orderBy: { createdAt: "desc" }
  })

  const decisionByCode = new Map<
    string,
    {
      code: string
      action: string
      category: string
      codeType: string
      createdAt: Date
    }
  >()

  for (const selection of selections) {
    if (!decisionByCode.has(selection.code)) {
      decisionByCode.set(selection.code, {
        code: selection.code,
        action: selection.action,
        category: selection.category,
        codeType: selection.codeType,
        createdAt: selection.createdAt
      })
    }
  }

  return Array.from(decisionByCode.values())
}

async function nextVersion(noteId: string): Promise<number> {
  const latest = await prisma.noteVersion.findFirst({
    where: { noteId },
    orderBy: { versionNumber: "desc" }
  })

  return (latest?.versionNumber ?? 0) + 1
}

export const wizardRoutes = Router()

wizardRoutes.get("/:encounterId/state", async (req, res, next) => {
  try {
    const encounter = await resolveEncounter(req.params.encounterId)
    if (!encounter || !encounter.note) {
      throw new ApiError(404, "Encounter or note not found")
    }

    const latestRun = await prisma.wizardRun.findFirst({
      where: { encounterId: encounter.id },
      orderBy: { startedAt: "desc" },
      include: {
        stepStates: {
          orderBy: { updatedAt: "asc" }
        }
      }
    })

    const decisions = await getLatestDecisions(encounter.id)

    const latestComposeVersion = await prisma.noteVersion.findFirst({
      where: {
        noteId: encounter.note.id,
        source: {
          in: ["wizard-compose", "wizard-rebeautify", "wizard-finalize"]
        }
      },
      orderBy: { versionNumber: "desc" }
    })

    const exportArtifacts = await prisma.exportArtifact.findMany({
      where: { encounterId: encounter.id },
      orderBy: { createdAt: "desc" }
    })

    const completedSteps = new Set(
      latestRun?.stepStates
        .filter((state) => state.status === "COMPLETED")
        .map((state) => state.step) ?? []
    )

    let suggestedStep = 1
    if (completedSteps.has("STEP1_CODE_REVIEW")) suggestedStep = 2
    if (completedSteps.has("STEP2_SUGGESTION_REVIEW")) suggestedStep = 3
    if (completedSteps.has("STEP3_COMPOSE")) suggestedStep = 4
    if (completedSteps.has("STEP4_COMPARE_EDIT")) suggestedStep = 5
    if (completedSteps.has("STEP5_BILLING_ATTEST")) suggestedStep = 6
    if (encounter.status === "FINALIZED") suggestedStep = 6

    res.status(200).json({
      state: {
        encounterId: encounter.externalId,
        suggestedStep,
        runId: latestRun?.id ?? null,
        runStatus: latestRun?.status ?? null,
        stepStates: latestRun?.stepStates ?? [],
        decisions,
        note: {
          content: encounter.note.content,
          patientSummary: encounter.note.patientSummary,
          status: encounter.note.status
        },
        latestComposeVersion: latestComposeVersion
          ? {
              versionNumber: latestComposeVersion.versionNumber,
              source: latestComposeVersion.source,
              traceId: latestComposeVersion.traceId,
              content: latestComposeVersion.content,
              patientSummary: latestComposeVersion.patientSummary
            }
          : null,
        exportArtifacts
      }
    })
  } catch (error) {
    next(error)
  }
})

wizardRoutes.post("/:encounterId/step/:step/actions", requireRole(["ADMIN", "CLINICIAN"]), async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthenticatedRequest
    const step = Number(req.params.step)
    const mappedStep = STEP_MAP[step]

    if (!mappedStep) {
      throw new ApiError(400, "Invalid wizard step")
    }

    const encounter = await resolveEncounter(req.params.encounterId)
    if (!encounter) {
      throw new ApiError(404, "Encounter not found")
    }

    const payload = stepActionSchema.parse(req.body)
    const run = await getOrCreateWizardRun(encounter.id)

    let selectedCodePayload = payload

    if (payload.suggestionId) {
      const suggestion = await prisma.codeSuggestion.findUnique({ where: { id: payload.suggestionId } })
      if (!suggestion) {
        throw new ApiError(404, "Suggestion not found")
      }

      selectedCodePayload = {
        ...payload,
        code: suggestion.code,
        codeType: suggestion.codeType,
        category: suggestion.category
      }

      await prisma.codeSuggestion.update({
        where: { id: suggestion.id },
        data: {
          status: payload.actionType === "remove" ? "REMOVED" : "SELECTED"
        }
      })
    }

    if (selectedCodePayload.code && selectedCodePayload.codeType && selectedCodePayload.category) {
      await prisma.codeSelection.create({
        data: {
          encounterId: encounter.id,
          codeSuggestionId: payload.suggestionId,
          code: selectedCodePayload.code,
          codeType: selectedCodePayload.codeType,
          category: selectedCodePayload.category as SuggestionCategory,
          action: mapActionToSelection(payload.actionType),
          decisionReason: payload.reason,
          actorId: authReq.user.id
        }
      })
    }

    const stepState = await upsertStepState({
      wizardRunId: run.id,
      encounterId: encounter.id,
      step: mappedStep,
      status: "COMPLETED",
      payload: {
        actionType: payload.actionType,
        suggestionId: payload.suggestionId,
        code: selectedCodePayload.code,
        reason: payload.reason,
        context: payload.payload ?? null
      },
      actorId: authReq.user.id
    })

    sseHub.publish(encounter.externalId, {
      type: "wizard.step-action",
      data: {
        step,
        actionType: payload.actionType,
        code: selectedCodePayload.code
      }
    })

    res.status(200).json({ stepState })
  } catch (error) {
    next(error)
  }
})

wizardRoutes.post("/:encounterId/compose", requireRole(["ADMIN", "CLINICIAN"]), async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthenticatedRequest
    const encounter = await resolveEncounter(req.params.encounterId)
    if (!encounter || !encounter.note) {
      throw new ApiError(404, "Encounter or note not found")
    }

    const payload = composeSchema.parse(req.body)
    const run = await getOrCreateWizardRun(encounter.id)
    const promptProfile = await resolvePromptProfile(authReq)

    await upsertStepState({
      wizardRunId: run.id,
      encounterId: encounter.id,
      step: WizardStep.STEP3_COMPOSE,
      status: "IN_PROGRESS",
      payload: {
        startedAt: new Date().toISOString()
      },
      actorId: authReq.user.id
    })

    const composedResult = await composeNoteOrchestrated({
      noteContent: payload.noteContent ?? encounter.note.content
    }, promptProfile)

    const traceArtifact = await persistTraceJson({
      runId: run.id,
      fileName: "compose-trace.json",
      payload: {
        runId: run.id,
        encounterId: encounter.externalId,
        orchestration: composedResult.trace,
        outputTraceId: composedResult.output.traceId,
        promptVersionId: composedResult.trace.promptVersionId ?? composedResult.prompt.versionId,
        stages: composedResult.output.stages,
        guardrailWarnings: composedResult.guardrailWarnings ?? [],
        createdAt: new Date().toISOString()
      }
    })

    const traceRecord = await prisma.exportArtifact.create({
      data: {
        encounterId: encounter.id,
        noteId: encounter.note.id,
        type: ArtifactType.TRACE_JSON,
        filePath: traceArtifact.filePath,
        mimeType: "application/json",
        fileName: traceArtifact.fileName,
        sizeBytes: traceArtifact.sizeBytes,
        createdById: authReq.user.id
      }
    })

    const newVersionNumber = await nextVersion(encounter.note.id)

    await prisma.$transaction(async (tx) => {
      await tx.note.update({
        where: { id: encounter.note!.id },
        data: {
          content: composedResult.output.enhancedNote,
          patientSummary: composedResult.output.patientSummary,
          updatedById: authReq.user.id
        }
      })

      await tx.noteVersion.create({
        data: {
          noteId: encounter.note!.id,
          versionNumber: newVersionNumber,
          source: "wizard-compose",
          content: composedResult.output.enhancedNote,
          patientSummary: composedResult.output.patientSummary,
          traceId: composedResult.output.traceId,
          createdById: authReq.user.id
        }
      })

      await upsertStepState({
        wizardRunId: run.id,
        encounterId: encounter.id,
        step: WizardStep.STEP3_COMPOSE,
        status: "COMPLETED",
        payload: {
          traceId: composedResult.output.traceId,
          orchestrationTraceId: composedResult.trace.traceId,
          promptVersionId: composedResult.trace.promptVersionId ?? composedResult.prompt.versionId,
          stages: composedResult.output.stages,
          guardrailWarnings: composedResult.guardrailWarnings ?? [],
          traceArtifactId: traceRecord.id,
          provider: composedResult.trace.provider
        },
        actorId: authReq.user.id
      })

      await upsertStepState({
        wizardRunId: run.id,
        encounterId: encounter.id,
        step: WizardStep.STEP4_COMPARE_EDIT,
        status: "IN_PROGRESS",
        payload: {
          ready: true
        },
        actorId: authReq.user.id
      })
    })

    for (const stage of composedResult.output.stages) {
      sseHub.publish(encounter.externalId, {
        type: "wizard.compose.stage",
        data: stage
      })
    }

    await writeAuditLog({
      req,
      res,
      action: "compose",
      entity: "wizard",
      entityId: run.id,
      encounterId: encounter.id,
      details: {
        traceId: composedResult.output.traceId,
        orchestrationTraceId: composedResult.trace.traceId,
        promptVersionId: composedResult.trace.promptVersionId ?? composedResult.prompt.versionId,
        traceArtifactId: traceRecord.id,
        provider: composedResult.trace.provider,
        guardrailWarnings: composedResult.guardrailWarnings ?? []
      }
    })

    res.status(200).json({
      traceId: composedResult.output.traceId,
      promptVersionId: composedResult.trace.promptVersionId ?? composedResult.prompt.versionId,
      enhancedNote: composedResult.output.enhancedNote,
      patientSummary: composedResult.output.patientSummary,
      stages: composedResult.output.stages,
      guardrailWarnings: composedResult.guardrailWarnings ?? []
    })
  } catch (error) {
    next(error)
  }
})

wizardRoutes.post("/:encounterId/rebeautify", requireRole(["ADMIN", "CLINICIAN"]), async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthenticatedRequest
    const encounter = await resolveEncounter(req.params.encounterId)
    if (!encounter || !encounter.note) {
      throw new ApiError(404, "Encounter or note not found")
    }

    const payload = composeSchema.parse(req.body)
    const promptProfile = await resolvePromptProfile(authReq)
    const composedResult = await composeNoteOrchestrated({
      noteContent: payload.noteContent ?? encounter.note.content
    }, promptProfile)

    const traceArtifact = await persistTraceJson({
      runId: `rebeautify-${encounter.id}-${Date.now()}`,
      fileName: "rebeautify-trace.json",
      payload: {
        encounterId: encounter.externalId,
        orchestration: composedResult.trace,
        outputTraceId: composedResult.output.traceId,
        promptVersionId: composedResult.trace.promptVersionId ?? composedResult.prompt.versionId,
        guardrailWarnings: composedResult.guardrailWarnings ?? [],
        createdAt: new Date().toISOString()
      }
    })

    await prisma.exportArtifact.create({
      data: {
        encounterId: encounter.id,
        noteId: encounter.note.id,
        type: ArtifactType.TRACE_JSON,
        filePath: traceArtifact.filePath,
        mimeType: "application/json",
        fileName: traceArtifact.fileName,
        sizeBytes: traceArtifact.sizeBytes,
        createdById: authReq.user.id
      }
    })

    const versionNumber = await nextVersion(encounter.note.id)
    await prisma.noteVersion.create({
      data: {
        noteId: encounter.note.id,
        versionNumber,
        source: "wizard-rebeautify",
        content: composedResult.output.enhancedNote,
        patientSummary: composedResult.output.patientSummary,
        traceId: composedResult.output.traceId,
        createdById: authReq.user.id
      }
    })

    await prisma.note.update({
      where: { id: encounter.note.id },
      data: {
        content: composedResult.output.enhancedNote,
        patientSummary: composedResult.output.patientSummary,
        updatedById: authReq.user.id
      }
    })

    sseHub.publish(encounter.externalId, {
      type: "wizard.rebeautify.completed",
      data: {
        traceId: composedResult.output.traceId,
        promptVersionId: composedResult.trace.promptVersionId ?? composedResult.prompt.versionId
      }
    })

    res.status(200).json({
      traceId: composedResult.output.traceId,
      promptVersionId: composedResult.trace.promptVersionId ?? composedResult.prompt.versionId,
      enhancedNote: composedResult.output.enhancedNote,
      patientSummary: composedResult.output.patientSummary,
      guardrailWarnings: composedResult.guardrailWarnings ?? []
    })
  } catch (error) {
    next(error)
  }
})

wizardRoutes.post("/:encounterId/billing-preview", requireRole(["ADMIN", "CLINICIAN"]), async (req, res, next) => {
  try {
    const encounter = await resolveEncounter(req.params.encounterId)
    if (!encounter) {
      throw new ApiError(404, "Encounter not found")
    }

    const payload = billingPreviewSchema.parse(req.body)
    const selectedCodes = await getSelectedCodes(encounter.id)
    const billing = calculateBillingEstimate({
      selectedCodes,
      payerModel: payload.payerModel,
      priorMonthlyRevenueCents: payload.monthlyRevenueCents,
      expectedCoderLiftPct: payload.expectedCoderLiftPct,
      deductibleRemainingCents: payload.deductibleRemainingCents,
      coinsurancePct: payload.coinsurancePct,
      copayCents: payload.copayCents
    })

    res.status(200).json({ billing })
  } catch (error) {
    next(error)
  }
})

wizardRoutes.post("/:encounterId/finalize", requireRole(["ADMIN", "CLINICIAN"]), async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthenticatedRequest
    const encounter = await resolveEncounter(req.params.encounterId)
    if (!encounter || !encounter.note) {
      throw new ApiError(404, "Encounter or note not found")
    }

    const payload = finalizeSchema.parse(req.body)

    const unresolvedCritical = await prisma.complianceIssue.findMany({
      where: {
        encounterId: encounter.id,
        status: "ACTIVE",
        severity: "CRITICAL"
      }
    })

    if (unresolvedCritical.length > 0) {
      throw new ApiError(409, "Cannot finalize with unresolved critical compliance issues", {
        issueIds: unresolvedCritical.map((issue) => issue.id)
      })
    }

    const run = await getOrCreateWizardRun(encounter.id)

    const finalNote = payload.finalNote ?? encounter.note.content
    const finalPatientSummary = payload.finalPatientSummary ?? encounter.note.patientSummary

    const selectedCodes = await getSelectedCodes(encounter.id)
    const billing = calculateBillingEstimate({
      selectedCodes,
      payerModel: payload.payerModel,
      priorMonthlyRevenueCents: payload.monthlyRevenueCents,
      expectedCoderLiftPct: payload.expectedCoderLiftPct,
      deductibleRemainingCents: payload.deductibleRemainingCents,
      coinsurancePct: payload.coinsurancePct,
      copayCents: payload.copayCents
    })

    await upsertStepState({
      wizardRunId: run.id,
      encounterId: encounter.id,
      step: WizardStep.STEP5_BILLING_ATTEST,
      status: "COMPLETED",
      payload: {
        attestClinicalAccuracy: payload.attestClinicalAccuracy,
        attestBillingAccuracy: payload.attestBillingAccuracy,
        payerModel: payload.payerModel ?? "default",
        billing
      },
      actorId: authReq.user.id
    })

    const exportBaseDir = path.resolve(env.STORAGE_DIR, "exports", encounter.externalId)

    const notePdf = await createPdfArtifact(exportBaseDir, "clinical-note.pdf", {
      title: "Final Clinical Note",
      subtitle: `Encounter ${encounter.externalId}`,
      content: finalNote
    })

    const summaryPdf = await createPdfArtifact(exportBaseDir, "patient-summary.pdf", {
      title: "Patient Summary",
      subtitle: `Encounter ${encounter.externalId}`,
      content: finalPatientSummary
    })

    const versionNumber = await nextVersion(encounter.note.id)

    const { artifacts } = await prisma.$transaction(async (tx) => {
      await tx.note.update({
        where: { id: encounter.note!.id },
        data: {
          content: finalNote,
          patientSummary: finalPatientSummary,
          status: "FINAL",
          visibility: "LOCKED",
          finalizedAt: new Date(),
          lockedAt: new Date(),
          updatedById: authReq.user.id
        }
      })

      await tx.noteVersion.create({
        data: {
          noteId: encounter.note!.id,
          versionNumber,
          source: "wizard-finalize",
          content: finalNote,
          patientSummary: finalPatientSummary,
          createdById: authReq.user.id
        }
      })

      await tx.encounter.update({
        where: { id: encounter.id },
        data: {
          status: "FINALIZED",
          finalizedAt: new Date()
        }
      })

      const noteArtifact = await tx.exportArtifact.create({
        data: {
          encounterId: encounter.id,
          noteId: encounter.note!.id,
          type: ArtifactType.NOTE_PDF,
          filePath: notePdf.filePath,
          mimeType: notePdf.mimeType,
          fileName: "clinical-note.pdf",
          sizeBytes: notePdf.sizeBytes,
          createdById: authReq.user.id
        }
      })

      const summaryArtifact = await tx.exportArtifact.create({
        data: {
          encounterId: encounter.id,
          noteId: encounter.note!.id,
          type: ArtifactType.PATIENT_SUMMARY_PDF,
          filePath: summaryPdf.filePath,
          mimeType: summaryPdf.mimeType,
          fileName: "patient-summary.pdf",
          sizeBytes: summaryPdf.sizeBytes,
          createdById: authReq.user.id
        }
      })

      const createdArtifacts = [noteArtifact, summaryArtifact]

      await upsertStepState({
        wizardRunId: run.id,
        encounterId: encounter.id,
        step: WizardStep.STEP6_SIGN_DISPATCH,
        status: "COMPLETED",
        payload: {
          dispatchedAt: new Date().toISOString(),
          artifacts: createdArtifacts.map((artifact) => ({ id: artifact.id, type: artifact.type }))
        },
        actorId: authReq.user.id
      })

      await tx.wizardRun.update({
        where: { id: run.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date()
        }
      })

      return { artifacts: createdArtifacts }
    })

    const dispatchJob = await enqueueDispatchJob({
      encounterId: encounter.id,
      noteId: encounter.note.id,
      createdById: authReq.user.id,
      payload: {
        encounterExternalId: encounter.externalId,
        patientExternalId: encounter.patient.externalId,
        providerName: encounter.provider?.name ?? "Unknown",
        noteContent: finalNote,
        patientSummary: finalPatientSummary,
        billing: {
          payerModel: billing.payerModel,
          selectedCptCodes: billing.selectedCptCodes,
          estimatedChargeCents: billing.estimatedChargeCents,
          expectedReimbursementCents: billing.expectedReimbursementCents
        },
        artifacts: artifacts.map((artifact) => ({
          id: artifact.id,
          type: artifact.type,
          fileName: artifact.fileName
        }))
      }
    })

    const dispatchResult = await attemptDispatchJob(dispatchJob.id)

    await upsertStepState({
      wizardRunId: run.id,
      encounterId: encounter.id,
      step: WizardStep.STEP6_SIGN_DISPATCH,
      status: "COMPLETED",
      payload: {
        dispatchedAt: new Date().toISOString(),
        artifacts: artifacts.map((artifact) => ({ id: artifact.id, type: artifact.type })),
        dispatch: dispatchResult
          ? {
              jobId: dispatchResult.id,
              status: dispatchResult.status,
              attemptCount: dispatchResult.attemptCount,
              nextRetryAt: dispatchResult.nextRetryAt,
              lastError: dispatchResult.lastError
            }
          : null
      },
      actorId: authReq.user.id
    })

    sseHub.publish(encounter.externalId, {
      type: "wizard.finalized",
      data: {
        encounterId: encounter.externalId,
        artifacts: artifacts.map((artifact) => ({ id: artifact.id, type: artifact.type })),
        dispatch: dispatchResult
          ? {
              jobId: dispatchResult.id,
              status: dispatchResult.status,
              attemptCount: dispatchResult.attemptCount,
              nextRetryAt: dispatchResult.nextRetryAt
            }
          : null,
        billing: {
          estimatedCharge: formatUsd(billing.estimatedChargeCents),
          outOfPocket: formatUsd(billing.outOfPocketCents),
          expectedReimbursement: formatUsd(billing.expectedReimbursementCents)
        }
      }
    })

    res.status(200).json({
      encounterId: encounter.externalId,
      status: "FINALIZED",
      billing,
      artifacts,
      dispatch: dispatchResult
        ? {
            jobId: dispatchResult.id,
            status: dispatchResult.status,
            attemptCount: dispatchResult.attemptCount,
            nextRetryAt: dispatchResult.nextRetryAt,
            lastError: dispatchResult.lastError
          }
        : null
    })
  } catch (error) {
    next(error)
  }
})
