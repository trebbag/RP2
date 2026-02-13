import fs from "node:fs/promises"
import path from "node:path"
import { Router } from "express"
import multer from "multer"
import { z } from "zod"
import { ArtifactType, ComplianceStatus } from "@prisma/client"
import { env } from "../config/env.js"
import { prisma } from "../lib/prisma.js"
import { ApiError } from "../middleware/errorHandler.js"
import type { AuthenticatedRequest } from "../types.js"
import { sseHub } from "../lib/sseHub.js"
import { generateSuggestionsOrchestrated, buildSuggestionInputHash, shouldRefreshSuggestions } from "../services/suggestionService.js"
import { generateComplianceIssuesOrchestrated } from "../services/complianceService.js"
import { persistTraceJson } from "../services/traceService.js"
import { transcribeAndDiarizeAudio } from "../services/sttService.js"
import { buildTranscriptQualityReport } from "../services/transcriptQualityService.js"
import { loadPromptProfileForUser } from "../services/promptBuilderService.js"
import { writeAuditLog } from "../middleware/audit.js"
import { requireRole } from "../middleware/auth.js"
import { ensureDir } from "../utils/fs.js"

const stopEncounterSchema = z.object({
  mode: z.enum(["pause", "stop"]).default("pause")
})

const transcriptSegmentSchema = z.object({
  speaker: z.string().min(1),
  speakerLabel: z.string().optional(),
  text: z.string().min(1),
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().nonnegative(),
  confidence: z.number().min(0).max(1).optional()
})

const refreshSuggestionsSchema = z.object({
  noteContent: z.string().default(""),
  trigger: z.enum(["manual", "delta"]).default("manual"),
  noteDeltaChars: z.number().int().nonnegative().default(0),
  transcriptDeltaChars: z.number().int().nonnegative().default(0),
  secondsSinceLastRefresh: z.number().int().nonnegative().default(999)
})

const complianceStatusSchema = z.object({
  status: z.enum(["ACTIVE", "DISMISSED", "RESOLVED"]),
  reason: z.string().optional()
})

const noteUpdateSchema = z.object({
  content: z.string().default(""),
  patientSummary: z.string().optional()
})

const streamMetricSchema = z.object({
  event: z.enum(["connected", "reconnect_attempt", "reconnect_success", "reconnect_failed"]),
  attempt: z.number().int().nonnegative().optional(),
  backoffMs: z.number().int().nonnegative().optional(),
  jitterMs: z.number().int().nonnegative().optional(),
  connectionUptimeMs: z.number().int().nonnegative().optional(),
  reason: z.string().optional(),
  clientId: z.string().min(3).max(80).optional()
})

const transcriptAudioMetaSchema = z.object({
  speakerHint: z.string().optional(),
  sessionElapsedMs: z.coerce.number().int().nonnegative().optional(),
  chunkDurationMs: z.coerce.number().int().positive().max(60_000).optional()
})

const transcriptCorrectionSchema = z.object({
  speaker: z.string().trim().min(1).max(40).optional(),
  speakerLabel: z.string().trim().min(1).max(40).optional(),
  text: z.string().trim().min(1).max(5_000).optional(),
  reason: z.string().trim().min(3).max(280).optional()
})

const transcriptChunkStorage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    const uploadDir = path.resolve(env.STORAGE_DIR, "transcript-chunks")
    await ensureDir(uploadDir)
    cb(null, uploadDir)
  },
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${safeName}`)
  }
})

const transcriptUpload = multer({
  storage: transcriptChunkStorage,
  limits: {
    fileSize: 15 * 1024 * 1024
  }
})

export const encounterRoutes = Router()

async function resolveEncounter(encounterIdentifier: string) {
  return prisma.encounter.findFirst({
    where: {
      OR: [{ id: encounterIdentifier }, { externalId: encounterIdentifier }]
    },
    include: {
      patient: true,
      note: true,
      chartAssets: {
        orderBy: { createdAt: "desc" },
        take: 1
      }
    }
  })
}

async function getSelectedCodes(encounterId: string): Promise<string[]> {
  const latestByCode = new Map<string, string>()
  const selections = await prisma.codeSelection.findMany({
    where: { encounterId },
    orderBy: { createdAt: "asc" }
  })

  for (const selection of selections) {
    if (selection.action === "KEEP" || selection.action === "ADD_FROM_SUGGESTION" || selection.action === "MOVE_TO_DIAGNOSIS" || selection.action === "MOVE_TO_DIFFERENTIAL") {
      latestByCode.set(selection.code, selection.code)
    }

    if (selection.action === "REMOVE") {
      latestByCode.delete(selection.code)
    }
  }

  return Array.from(latestByCode.values())
}

async function buildEncounterTranscriptQuality(encounterId: string) {
  const segments = await prisma.transcriptSegment.findMany({
    where: { encounterId },
    orderBy: { startMs: "asc" },
    take: 500
  })

  return buildTranscriptQualityReport(
    segments.map((segment) => ({
      id: segment.id,
      speaker: segment.speaker,
      speakerLabel: segment.speakerLabel,
      text: segment.text,
      confidence: segment.confidence,
      startMs: segment.startMs,
      endMs: segment.endMs
    }))
  )
}

async function resolvePromptProfile(req: AuthenticatedRequest) {
  return loadPromptProfileForUser(req.user.id)
}

encounterRoutes.get("/:encounterId", async (req, res, next) => {
  try {
    const encounter = await resolveEncounter(req.params.encounterId)
    if (!encounter) {
      throw new ApiError(404, "Encounter not found")
    }

    res.status(200).json({
      encounter: {
        id: encounter.externalId,
        status: encounter.status,
        patientId: encounter.patient.externalId,
        patientName: `${encounter.patient.firstName} ${encounter.patient.lastName}`.trim(),
        note: encounter.note
          ? {
              id: encounter.note.id,
              status: encounter.note.status,
              visibility: encounter.note.visibility,
              content: encounter.note.content,
              patientSummary: encounter.note.patientSummary,
              updatedAt: encounter.note.updatedAt
            }
          : null
      }
    })
  } catch (error) {
    next(error)
  }
})

encounterRoutes.post("/:encounterId/start", requireRole(["ADMIN", "CLINICIAN"]), async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthenticatedRequest
    const encounter = await resolveEncounter(req.params.encounterId)

    if (!encounter) {
      throw new ApiError(404, "Encounter not found")
    }

    const updated = await prisma.$transaction(async (tx) => {
      const nextEncounter = await tx.encounter.update({
        where: { id: encounter.id },
        data: {
          status: "ACTIVE",
          startedAt: encounter.startedAt ?? new Date(),
          draftUnhiddenAt: encounter.draftUnhiddenAt ?? new Date()
        }
      })

      if (encounter.note) {
        await tx.note.update({
          where: { id: encounter.note.id },
          data: {
            status: "DRAFT_ACTIVE",
            visibility: "VISIBLE",
            updatedById: authReq.user.id
          }
        })
      }

      return nextEncounter
    })

    sseHub.publish(encounter.externalId, {
      type: "encounter.status",
      data: { encounterId: encounter.externalId, status: updated.status }
    })

    await writeAuditLog({
      req,
      res,
      action: "start",
      entity: "encounter",
      entityId: encounter.id,
      encounterId: encounter.id
    })

    res.status(200).json({
      encounterId: encounter.externalId,
      status: updated.status,
      noteVisibility: "VISIBLE"
    })
  } catch (error) {
    next(error)
  }
})

encounterRoutes.post("/:encounterId/stop", requireRole(["ADMIN", "CLINICIAN"]), async (req, res, next) => {
  try {
    const payload = stopEncounterSchema.parse(req.body)
    const encounter = await resolveEncounter(req.params.encounterId)

    if (!encounter) {
      throw new ApiError(404, "Encounter not found")
    }

    const nextStatus = payload.mode === "pause" ? "PAUSED" : "STOPPED"
    const updated = await prisma.encounter.update({
      where: { id: encounter.id },
      data: {
        status: nextStatus,
        stoppedAt: new Date()
      }
    })

    sseHub.publish(encounter.externalId, {
      type: "encounter.status",
      data: { encounterId: encounter.externalId, status: updated.status }
    })

    res.status(200).json({ encounterId: encounter.externalId, status: updated.status })
  } catch (error) {
    next(error)
  }
})

encounterRoutes.post("/:encounterId/note", requireRole(["ADMIN", "CLINICIAN"]), async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthenticatedRequest
    const payload = noteUpdateSchema.parse(req.body)
    const encounter = await resolveEncounter(req.params.encounterId)

    if (!encounter || !encounter.note) {
      throw new ApiError(404, "Encounter or note not found")
    }

    const note = await prisma.note.update({
      where: { id: encounter.note.id },
      data: {
        content: payload.content,
        patientSummary: payload.patientSummary ?? encounter.note.patientSummary,
        updatedById: authReq.user.id
      }
    })

    const latestVersion = await prisma.noteVersion.findFirst({
      where: { noteId: note.id },
      orderBy: { versionNumber: "desc" }
    })

    await prisma.noteVersion.create({
      data: {
        noteId: note.id,
        versionNumber: (latestVersion?.versionNumber ?? 0) + 1,
        source: "autosave",
        content: note.content,
        patientSummary: note.patientSummary,
        createdById: authReq.user.id
      }
    })

    sseHub.publish(encounter.externalId, {
      type: "note.updated",
      data: {
        encounterId: encounter.externalId,
        updatedAt: note.updatedAt
      }
    })

    res.status(200).json({ note })
  } catch (error) {
    next(error)
  }
})

encounterRoutes.get("/:encounterId/transcript/stream", async (req, res, next) => {
  try {
    const encounter = await resolveEncounter(req.params.encounterId)
    if (!encounter) {
      throw new ApiError(404, "Encounter not found")
    }

    res.setHeader("Content-Type", "text/event-stream")
    res.setHeader("Cache-Control", "no-cache")
    res.setHeader("Connection", "keep-alive")
    res.flushHeaders?.()

    const queryClientId =
      typeof req.query.clientId === "string" && req.query.clientId.trim().length > 0
        ? req.query.clientId.trim().slice(0, 80)
        : null
    const clientId = queryClientId ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    sseHub.subscribe(encounter.externalId, clientId, res)

    const latestSegments = await prisma.transcriptSegment.findMany({
      where: { encounterId: encounter.id },
      orderBy: { createdAt: "asc" },
      take: 200
    })

    res.write(`event: connected\n`)
    res.write(
      `data: ${JSON.stringify({
        encounterId: encounter.externalId,
        segments: latestSegments
      })}\n\n`
    )
  } catch (error) {
    next(error)
  }
})

encounterRoutes.post("/:encounterId/transcript/stream-metrics", requireRole(["ADMIN", "CLINICIAN"]), async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthenticatedRequest
    const encounter = await resolveEncounter(req.params.encounterId)
    if (!encounter) {
      throw new ApiError(404, "Encounter not found")
    }

    const payload = streamMetricSchema.parse(req.body)
    await writeAuditLog({
      req,
      res,
      action: "sse_metric",
      entity: "encounter",
      entityId: encounter.id,
      encounterId: encounter.id,
      details: {
        actorRole: authReq.user.role,
        stream: payload
      }
    })

    res.status(202).json({ accepted: true })
  } catch (error) {
    next(error)
  }
})

encounterRoutes.get("/:encounterId/transcript/quality", requireRole(["ADMIN", "CLINICIAN"]), async (req, res, next) => {
  try {
    const encounter = await resolveEncounter(req.params.encounterId)
    if (!encounter) {
      throw new ApiError(404, "Encounter not found")
    }

    const report = await buildEncounterTranscriptQuality(encounter.id)
    res.status(200).json({
      encounterId: encounter.externalId,
      report
    })
  } catch (error) {
    next(error)
  }
})

encounterRoutes.post(
  "/:encounterId/transcript/audio",
  requireRole(["ADMIN", "CLINICIAN"]),
  transcriptUpload.single("audio"),
  async (req, res, next) => {
    let uploadedPath: string | null = null

    try {
      const authReq = req as unknown as AuthenticatedRequest
      const encounter = await resolveEncounter(req.params.encounterId)
      if (!encounter) {
        throw new ApiError(404, "Encounter not found")
      }

      if (!req.file) {
        throw new ApiError(400, "Audio file is required")
      }

      uploadedPath = req.file.path
      const payload = transcriptAudioMetaSchema.parse(req.body ?? {})
      const latestSegment = await prisma.transcriptSegment.findFirst({
        where: { encounterId: encounter.id },
        orderBy: { endMs: "desc" }
      })
      const promptProfile = await resolvePromptProfile(authReq)

      const sttResult = await transcribeAndDiarizeAudio({
        filePath: req.file.path,
        mimeType: req.file.mimetype || "audio/webm",
        speakerHint: payload.speakerHint,
        sessionElapsedMs: payload.sessionElapsedMs,
        chunkDurationMs: payload.chunkDurationMs,
        lastKnownEndMs: latestSegment?.endMs ?? 0,
        promptProfile
      })

      if (sttResult.segments.length === 0) {
        res.status(202).json({
          accepted: true,
          segments: [],
          transcriptText: sttResult.transcriptText,
          provider: sttResult.provider,
          warnings: sttResult.warnings
        })
        return
      }

      const createdSegments = await prisma.$transaction(
        sttResult.segments.map((segment) =>
          prisma.transcriptSegment.create({
            data: {
              encounterId: encounter.id,
              speaker: segment.speaker,
              speakerLabel: segment.speakerLabel,
              text: segment.text,
              startMs: segment.startMs,
              endMs: segment.endMs,
              confidence: segment.confidence
            }
          })
        )
      )

      for (const segment of createdSegments) {
        sseHub.publish(encounter.externalId, {
          type: "transcript.segment",
          data: {
            id: segment.id,
            speaker: segment.speaker,
            speakerLabel: segment.speakerLabel,
            text: segment.text,
            startMs: segment.startMs,
            endMs: segment.endMs,
            createdAt: segment.createdAt
          }
        })
      }

      await writeAuditLog({
        req,
        res,
        action: "transcript_audio_ingested",
        entity: "encounter",
        entityId: encounter.id,
        encounterId: encounter.id,
        details: {
          segmentCount: createdSegments.length,
          provider: sttResult.provider,
          warnings: sttResult.warnings,
          diarizationTraceId: sttResult.diarizationTrace?.traceId ?? null,
          diarizationPromptVersionId: sttResult.diarizationTrace?.promptVersionId ?? null,
          diarizationPromptProfileDigest: sttResult.diarizationTrace?.promptProfileDigest ?? null
        }
      })

      const qualityReport = await buildEncounterTranscriptQuality(encounter.id)
      if (qualityReport.needsReview) {
        sseHub.publish(encounter.externalId, {
          type: "transcript.quality",
          data: qualityReport
        })
      }

      res.status(201).json({
        accepted: true,
        provider: sttResult.provider,
        transcriptText: sttResult.transcriptText,
        warnings: sttResult.warnings,
        diarizationTraceId: sttResult.diarizationTrace?.traceId ?? null,
        diarizationPromptVersionId: sttResult.diarizationTrace?.promptVersionId ?? null,
        segments: createdSegments,
        qualityReport
      })
    } catch (error) {
      next(error)
    } finally {
      if (uploadedPath) {
        await fs.rm(uploadedPath, { force: true }).catch(() => undefined)
      }
    }
  }
)

encounterRoutes.post("/:encounterId/transcript/segments", requireRole(["ADMIN", "CLINICIAN"]), async (req, res, next) => {
  try {
    const encounter = await resolveEncounter(req.params.encounterId)
    if (!encounter) {
      throw new ApiError(404, "Encounter not found")
    }

    const payload = transcriptSegmentSchema.parse(req.body)

    const segment = await prisma.transcriptSegment.create({
      data: {
        encounterId: encounter.id,
        speaker: payload.speaker,
        speakerLabel: payload.speakerLabel,
        text: payload.text,
        startMs: payload.startMs,
        endMs: payload.endMs,
        confidence: payload.confidence
      }
    })

    sseHub.publish(encounter.externalId, {
      type: "transcript.segment",
      data: {
        id: segment.id,
        speaker: segment.speaker,
        text: segment.text,
        startMs: segment.startMs,
        endMs: segment.endMs,
        createdAt: segment.createdAt
      }
    })

    res.status(201).json({ segment })
  } catch (error) {
    next(error)
  }
})

encounterRoutes.post(
  "/:encounterId/transcript/segments/:segmentId/correct",
  requireRole(["ADMIN", "CLINICIAN"]),
  async (req, res, next) => {
    try {
      const authReq = req as unknown as AuthenticatedRequest
      const encounter = await resolveEncounter(req.params.encounterId)
      if (!encounter) {
        throw new ApiError(404, "Encounter not found")
      }

      const existing = await prisma.transcriptSegment.findFirst({
        where: {
          id: req.params.segmentId,
          encounterId: encounter.id
        }
      })

      if (!existing) {
        throw new ApiError(404, "Transcript segment not found")
      }

      const payload = transcriptCorrectionSchema.parse(req.body ?? {})
      if (!payload.speaker && !payload.speakerLabel && !payload.text) {
        throw new ApiError(400, "At least one transcript field must be provided for correction")
      }

      const updated = await prisma.transcriptSegment.update({
        where: { id: existing.id },
        data: {
          speaker: payload.speaker ?? existing.speaker,
          speakerLabel: payload.speakerLabel ?? existing.speakerLabel,
          text: payload.text ?? existing.text
        }
      })

      sseHub.publish(encounter.externalId, {
        type: "transcript.segment.corrected",
        data: {
          id: updated.id,
          speaker: updated.speaker,
          speakerLabel: updated.speakerLabel,
          text: updated.text,
          startMs: updated.startMs,
          endMs: updated.endMs,
          confidence: updated.confidence,
          createdAt: updated.createdAt
        }
      })

      await writeAuditLog({
        req,
        res,
        action: "transcript_segment_corrected",
        entity: "transcript_segment",
        entityId: updated.id,
        encounterId: encounter.id,
        details: {
          reason: payload.reason ?? null,
          before: {
            speaker: existing.speaker,
            speakerLabel: existing.speakerLabel,
            text: existing.text
          },
          after: {
            speaker: updated.speaker,
            speakerLabel: updated.speakerLabel,
            text: updated.text
          },
          actor: authReq.user.id
        }
      })

      const qualityReport = await buildEncounterTranscriptQuality(encounter.id)
      res.status(200).json({
        segment: updated,
        qualityReport
      })
    } catch (error) {
      next(error)
    }
  }
)

encounterRoutes.post("/:encounterId/suggestions/refresh", requireRole(["ADMIN", "CLINICIAN"]), async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthenticatedRequest
    const encounter = await resolveEncounter(req.params.encounterId)
    if (!encounter || !encounter.note) {
      throw new ApiError(404, "Encounter or note not found")
    }

    const payload = refreshSuggestionsSchema.parse(req.body)
    const shouldRun = payload.trigger === "manual" || shouldRefreshSuggestions(payload)

    if (!shouldRun) {
      res.status(200).json({ skipped: true, reason: "Delta thresholds not met" })
      return
    }

    const transcriptSegments = await prisma.transcriptSegment.findMany({
      where: { encounterId: encounter.id },
      orderBy: { createdAt: "desc" },
      take: 100
    })

    const transcriptText = transcriptSegments
      .reverse()
      .map((segment) => `${segment.speaker}: ${segment.text}`)
      .join("\n")

    const chartContext = encounter.chartAssets[0]?.extractedJson as Record<string, unknown> | undefined

    const suggestionInput = {
      noteContent: payload.noteContent || encounter.note.content,
      transcriptText,
      chartContext
    }
    const promptProfile = await resolvePromptProfile(authReq)

    const generation = await prisma.suggestionGeneration.create({
      data: {
        encounterId: encounter.id,
        trigger: payload.trigger,
        textDelta: payload.noteDeltaChars,
        transcriptDelta: payload.transcriptDeltaChars,
        inputHash: buildSuggestionInputHash(suggestionInput),
        createdById: authReq.user.id
      }
    })

    const suggestionResult = await generateSuggestionsOrchestrated(suggestionInput, promptProfile)

    const traceArtifact = await persistTraceJson({
      runId: generation.id,
      fileName: "suggestions-trace.json",
      payload: {
        task: "suggestions",
        encounterId: encounter.externalId,
        generatedAt: new Date().toISOString(),
        trace: suggestionResult.trace,
        promptVersionId: suggestionResult.trace.promptVersionId ?? suggestionResult.prompt.versionId,
        guardrailWarnings: suggestionResult.guardrailWarnings ?? []
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

    const createdSuggestions = await prisma.$transaction(
      suggestionResult.output.map((suggestion) =>
        prisma.codeSuggestion.create({
          data: {
            encounterId: encounter.id,
            generationId: generation.id,
            code: suggestion.code,
            codeType: suggestion.codeType,
            category: suggestion.category,
            title: suggestion.title,
            description: suggestion.description,
            rationale: suggestion.rationale,
            confidence: suggestion.confidence,
            evidence: suggestion.evidence as never,
            status: "SUGGESTED"
          }
        })
      )
    )

    sseHub.publish(encounter.externalId, {
      type: "suggestions.refresh",
      data: {
        generationId: generation.id,
        count: createdSuggestions.length,
        traceId: suggestionResult.trace.traceId,
        promptVersionId: suggestionResult.trace.promptVersionId ?? suggestionResult.prompt.versionId
      }
    })

    await writeAuditLog({
      req,
      res,
      action: "suggestions_refresh",
      entity: "encounter",
      entityId: encounter.id,
      encounterId: encounter.id,
      details: {
        generationId: generation.id,
        traceId: suggestionResult.trace.traceId,
        promptVersionId: suggestionResult.trace.promptVersionId ?? suggestionResult.prompt.versionId,
        traceArtifactId: traceRecord.id,
        provider: suggestionResult.trace.provider,
        guardrailWarnings: suggestionResult.guardrailWarnings ?? []
      }
    })

    res.status(200).json({
      generationId: generation.id,
      suggestions: createdSuggestions,
      traceId: suggestionResult.trace.traceId,
      promptVersionId: suggestionResult.trace.promptVersionId ?? suggestionResult.prompt.versionId,
      guardrailWarnings: suggestionResult.guardrailWarnings ?? []
    })
  } catch (error) {
    next(error)
  }
})

encounterRoutes.get("/:encounterId/compliance", async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthenticatedRequest
    const encounter = await resolveEncounter(req.params.encounterId)
    if (!encounter || !encounter.note) {
      throw new ApiError(404, "Encounter or note not found")
    }

    const selectedCodes = await getSelectedCodes(encounter.id)
    const complianceInput = {
      noteContent: encounter.note.content,
      selectedCodes
    }
    const promptProfile = await resolvePromptProfile(authReq)

    const generated = await generateComplianceIssuesOrchestrated(complianceInput, promptProfile)

    const traceArtifact = await persistTraceJson({
      runId: `compliance-${encounter.id}-${Date.now()}`,
      fileName: "compliance-trace.json",
      payload: {
        task: "compliance",
        encounterId: encounter.externalId,
        generatedAt: new Date().toISOString(),
        trace: generated.trace,
        promptVersionId: generated.trace.promptVersionId ?? generated.prompt.versionId,
        guardrailWarnings: generated.guardrailWarnings ?? []
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
        sizeBytes: traceArtifact.sizeBytes
      }
    })

    const issueIds: string[] = []

    for (const issue of generated.output) {
      const upserted = await prisma.complianceIssue.upsert({
        where: {
          encounterId_fingerprint: {
            encounterId: encounter.id,
            fingerprint: issue.fingerprint
          }
        },
        update: {
          severity: issue.severity,
          title: issue.title,
          description: issue.description,
          rationale: issue.rationale,
          remediation: issue.remediation,
          evidence: issue.evidence as never,
          status: "ACTIVE"
        },
        create: {
          encounterId: encounter.id,
          severity: issue.severity,
          status: "ACTIVE",
          title: issue.title,
          description: issue.description,
          rationale: issue.rationale,
          remediation: issue.remediation,
          evidence: issue.evidence as never,
          fingerprint: issue.fingerprint
        }
      })

      issueIds.push(upserted.id)
    }

    const issues = await prisma.complianceIssue.findMany({
      where: {
        encounterId: encounter.id
      },
      orderBy: [{ severity: "asc" }, { createdAt: "desc" }]
    })

    await writeAuditLog({
      req,
      res,
      action: "compliance_refresh",
      entity: "encounter",
      entityId: encounter.id,
      encounterId: encounter.id,
      details: {
        traceId: generated.trace.traceId,
        promptVersionId: generated.trace.promptVersionId ?? generated.prompt.versionId,
        traceArtifactId: traceRecord.id,
        provider: generated.trace.provider,
        guardrailWarnings: generated.guardrailWarnings ?? []
      }
    })

    res.status(200).json({
      issues,
      activeIssueIds: issueIds,
      traceId: generated.trace.traceId,
      promptVersionId: generated.trace.promptVersionId ?? generated.prompt.versionId,
      guardrailWarnings: generated.guardrailWarnings ?? []
    })
  } catch (error) {
    next(error)
  }
})

encounterRoutes.post("/:encounterId/compliance/:issueId/status", requireRole(["ADMIN", "CLINICIAN"]), async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthenticatedRequest
    const encounter = await resolveEncounter(req.params.encounterId)
    if (!encounter) {
      throw new ApiError(404, "Encounter not found")
    }

    const payload = complianceStatusSchema.parse(req.body)

    const updated = await prisma.complianceIssue.update({
      where: { id: req.params.issueId },
      data: {
        status: payload.status as ComplianceStatus,
        actorId: authReq.user.id,
        dismissedAt: payload.status === "DISMISSED" ? new Date() : null,
        resolvedAt: payload.status === "RESOLVED" ? new Date() : null
      }
    })

    sseHub.publish(encounter.externalId, {
      type: "compliance.updated",
      data: {
        issueId: updated.id,
        status: updated.status
      }
    })

    res.status(200).json({ issue: updated })
  } catch (error) {
    next(error)
  }
})
