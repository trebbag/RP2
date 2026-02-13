import { Router } from "express"
import { DispatchStatus } from "@prisma/client"
import { z } from "zod"
import { env } from "../config/env.js"
import { requireRole } from "../middleware/auth.js"
import { prisma } from "../lib/prisma.js"
import { runAuditRetentionPolicy } from "../services/auditRetentionService.js"
import { writeAuditLog } from "../middleware/audit.js"
import type { AuthenticatedRequest } from "../types.js"
import { getBillingSchedulePack, saveBillingSchedulePack } from "../services/billingService.js"
import { getSecretRotationStatus, recordSecretRotationEvent } from "../services/secretRotationService.js"
import {
  deadLetterSummary,
  listDispatchJobs,
  markDispatchJobDeadLetter,
  processDueDispatchJobs,
  replayDispatchJob
} from "../services/dispatchService.js"
import { dispatchSandboxReadiness, validateDispatchContract } from "../services/dispatchContractValidationService.js"

const retentionSchema = z.object({
  dryRun: z.boolean().default(true)
})

export const adminRoutes = Router()

adminRoutes.post("/audit-retention/enforce", requireRole(["ADMIN"]), async (req, res, next) => {
  try {
    const payload = retentionSchema.parse(req.body)
    const report = await runAuditRetentionPolicy({
      dryRun: payload.dryRun
    })

    await writeAuditLog({
      req,
      res,
      action: "audit_retention_enforce",
      entity: "audit_log",
      entityId: "retention-policy",
      details: report
    })

    res.status(200).json({ report })
  } catch (error) {
    next(error)
  }
})

const dispatchRetrySchema = z.object({
  limit: z.number().int().positive().max(100).default(20)
})

const dispatchListSchema = z.object({
  status: z.enum(["PENDING", "RETRYING", "DISPATCHED", "FAILED", "DEAD_LETTER"]).optional(),
  encounterId: z.string().optional(),
  limit: z.coerce.number().int().positive().max(200).default(50)
})

const deadLetterSchema = z.object({
  reason: z.string().trim().min(3).max(250).default("Manually moved to dead-letter queue")
})

const observabilitySchema = z.object({
  windowMinutes: z.coerce.number().int().positive().max(24 * 60).default(60)
})

const observabilityTrendSchema = z.object({
  windowMinutes: z.coerce.number().int().positive().max(14 * 24 * 60).default(24 * 60),
  bucketMinutes: z.coerce.number().int().positive().max(24 * 60).default(60)
})

const userListSchema = z.object({
  limit: z.coerce.number().int().positive().max(200).default(100)
})

const mfaResetSchema = z.object({
  reason: z.string().trim().min(6).max(400)
})

const contractValidateSchema = z.object({
  target: z.enum(["FHIR_R4", "HL7_V2", "VENDOR_API", "NONE"]).default("NONE"),
  vendor: z.enum(["GENERIC", "ATHENAHEALTH", "NEXTGEN", "ECLINICALWORKS"]).optional(),
  payload: z.unknown().optional()
})

const updateBillingSchedulesSchema = z.object({
  pack: z.unknown()
})

const secretRotationRecordSchema = z.object({
  ticketId: z.string().trim().min(3).max(120),
  secrets: z.array(z.string().trim().min(2).max(120)).min(1).max(20),
  notes: z.string().trim().max(1000).optional(),
  rotatedAt: z.string().datetime().optional()
})

type ObservabilityTrendPoint = {
  bucketStart: string
  bucketEnd: string
  dispatch: {
    deadLetterCount: number
    terminalFailureCount: number
  }
  stt: {
    ingestCount: number
    fallbackCount: number
    fallbackRate: number
  }
  auth: {
    failureCount: number
  }
  aiQuality: {
    suggestions: {
      decisionCount: number
      acceptedCount: number
      acceptanceRate: number
    }
    transcript: {
      segmentCount: number
      correctionCount: number
      correctionRate: number
    }
    compliance: {
      reviewedCount: number
      dismissedCount: number
      resolvedCount: number
      falsePositiveRate: number
    }
  }
}

function resolveBucketIndex(date: Date | null | undefined, startMs: number, bucketMs: number, bucketCount: number) {
  if (!date) return null
  const eventMs = date.getTime()
  if (eventMs < startMs) return null
  const index = Math.floor((eventMs - startMs) / bucketMs)
  if (index < 0 || index >= bucketCount) return null
  return index
}

function buildObservabilityTrendPoints(windowMinutes: number, requestedBucketMinutes: number) {
  const bucketMinutes = Math.min(windowMinutes, Math.max(1, requestedBucketMinutes))
  const bucketMs = bucketMinutes * 60 * 1000
  const bucketCount = Math.max(1, Math.ceil(windowMinutes / bucketMinutes))
  const alignedEndMs = Math.ceil(Date.now() / bucketMs) * bucketMs
  const startMs = alignedEndMs - bucketCount * bucketMs

  const points: ObservabilityTrendPoint[] = Array.from({ length: bucketCount }, (_, index) => {
    const bucketStartMs = startMs + index * bucketMs
    const bucketEndMs = bucketStartMs + bucketMs
    return {
      bucketStart: new Date(bucketStartMs).toISOString(),
      bucketEnd: new Date(bucketEndMs).toISOString(),
      dispatch: {
        deadLetterCount: 0,
        terminalFailureCount: 0
      },
      stt: {
        ingestCount: 0,
        fallbackCount: 0,
        fallbackRate: 0
      },
      auth: {
        failureCount: 0
      },
      aiQuality: {
        suggestions: {
          decisionCount: 0,
          acceptedCount: 0,
          acceptanceRate: 0
        },
        transcript: {
          segmentCount: 0,
          correctionCount: 0,
          correctionRate: 0
        },
        compliance: {
          reviewedCount: 0,
          dismissedCount: 0,
          resolvedCount: 0,
          falsePositiveRate: 0
        }
      }
    }
  })

  return {
    points,
    startMs,
    endMs: alignedEndMs,
    bucketMs,
    bucketCount,
    bucketMinutes
  }
}

adminRoutes.post("/dispatch/retry-due", requireRole(["ADMIN"]), async (req, res, next) => {
  try {
    const payload = dispatchRetrySchema.parse(req.body ?? {})
    const processed = await processDueDispatchJobs(payload.limit)

    await writeAuditLog({
      req,
      res,
      action: "dispatch_retry_due",
      entity: "dispatch_job",
      entityId: "bulk-retry",
      details: {
        count: processed.length,
        ids: processed.map((job) => job.id)
      }
    })

    res.status(200).json({
      processed: processed.map((job) => ({
        id: job.id,
        status: job.status,
        attemptCount: job.attemptCount,
        nextRetryAt: job.nextRetryAt,
        lastError: job.lastError
      }))
    })
  } catch (error) {
    next(error)
  }
})

adminRoutes.get("/dispatch/jobs", requireRole(["ADMIN"]), async (req, res, next) => {
  try {
    const payload = dispatchListSchema.parse(req.query ?? {})
    const jobs = await listDispatchJobs({
      status: payload.status as DispatchStatus | undefined,
      encounterId: payload.encounterId,
      limit: payload.limit
    })

    res.status(200).json({
      jobs: jobs.map((job) => ({
        id: job.id,
        encounterId: job.encounterId,
        target: job.target,
        contractType: job.contractType,
        status: job.status,
        attemptCount: job.attemptCount,
        maxAttempts: job.maxAttempts,
        nextRetryAt: job.nextRetryAt,
        dispatchedAt: job.dispatchedAt,
        deadLetteredAt: job.deadLetteredAt,
        externalMessageId: job.externalMessageId,
        lastError: job.lastError,
        updatedAt: job.updatedAt,
        createdAt: job.createdAt
      }))
    })
  } catch (error) {
    next(error)
  }
})

adminRoutes.post("/dispatch/:jobId/replay", requireRole(["ADMIN"]), async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthenticatedRequest
    const replayed = await replayDispatchJob(req.params.jobId, authReq.user.id)

    if (!replayed) {
      res.status(404).json({ error: "Dispatch job not found" })
      return
    }

    await writeAuditLog({
      req,
      res,
      action: "dispatch_replay_manual",
      entity: "dispatch_job",
      entityId: replayed.id,
      details: {
        status: replayed.status,
        attemptCount: replayed.attemptCount
      }
    })

    res.status(200).json({
      job: {
        id: replayed.id,
        status: replayed.status,
        attemptCount: replayed.attemptCount,
        nextRetryAt: replayed.nextRetryAt,
        deadLetteredAt: replayed.deadLetteredAt,
        lastError: replayed.lastError
      }
    })
  } catch (error) {
    next(error)
  }
})

adminRoutes.post("/dispatch/:jobId/dead-letter", requireRole(["ADMIN"]), async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthenticatedRequest
    const payload = deadLetterSchema.parse(req.body ?? {})
    const deadLettered = await markDispatchJobDeadLetter(req.params.jobId, payload.reason, authReq.user.id)

    if (!deadLettered) {
      res.status(404).json({ error: "Dispatch job not found" })
      return
    }

    await writeAuditLog({
      req,
      res,
      action: "dispatch_dead_letter_manual",
      entity: "dispatch_job",
      entityId: deadLettered.id,
      details: {
        reason: deadLettered.lastError
      }
    })

    res.status(200).json({
      job: {
        id: deadLettered.id,
        status: deadLettered.status,
        deadLetteredAt: deadLettered.deadLetteredAt,
        lastError: deadLettered.lastError
      }
    })
  } catch (error) {
    next(error)
  }
})

adminRoutes.post("/dispatch/contract/validate", requireRole(["ADMIN"]), async (req, res, next) => {
  try {
    const payload = contractValidateSchema.parse(req.body ?? {})
    const result = validateDispatchContract({
      target: payload.target,
      vendor: payload.vendor,
      payload: payload.payload
    })

    res.status(200).json({
      validation: result
    })
  } catch (error) {
    next(error)
  }
})

adminRoutes.get("/billing/fee-schedules", requireRole(["ADMIN"]), async (req, res, next) => {
  try {
    const pack = getBillingSchedulePack()
    res.status(200).json({ pack })
  } catch (error) {
    next(error)
  }
})

adminRoutes.put("/billing/fee-schedules", requireRole(["ADMIN"]), async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthenticatedRequest
    const payload = updateBillingSchedulesSchema.parse(req.body ?? {})
    const saved = saveBillingSchedulePack({
      pack: payload.pack,
      actor: authReq.user.email
    })

    await writeAuditLog({
      req,
      res,
      action: "billing_schedule_pack_updated",
      entity: "billing_schedule_pack",
      entityId: saved.path,
      details: {
        packVersion: saved.pack.packVersion,
        updatedBy: saved.pack.updatedBy
      }
    })

    res.status(200).json(saved)
  } catch (error) {
    next(error)
  }
})

adminRoutes.get("/dispatch/sandbox-readiness", requireRole(["ADMIN"]), async (req, res, next) => {
  try {
    const authConfigured =
      env.DISPATCH_AUTH_MODE === "NONE" ||
      (env.DISPATCH_AUTH_MODE === "API_KEY" && Boolean(env.DISPATCH_API_KEY)) ||
      (env.DISPATCH_AUTH_MODE === "BEARER" && Boolean(env.DISPATCH_BEARER_TOKEN)) ||
      (env.DISPATCH_AUTH_MODE === "HMAC" && Boolean(env.DISPATCH_HMAC_SECRET))

    const readiness = dispatchSandboxReadiness({
      target: env.DISPATCH_TARGET,
      vendor: env.DISPATCH_VENDOR,
      webhookConfigured: Boolean(env.DISPATCH_WEBHOOK_URL),
      mllpConfigured: Boolean(env.DISPATCH_MLLP_HOST && env.DISPATCH_MLLP_PORT),
      authConfigured,
      mtlsConfigured: Boolean(env.DISPATCH_CLIENT_CERT_PATH && env.DISPATCH_CLIENT_KEY_PATH)
    })

    res.status(200).json({
      configuredTarget: env.DISPATCH_TARGET,
      configuredVendor: env.DISPATCH_VENDOR,
      authMode: env.DISPATCH_AUTH_MODE,
      readiness
    })
  } catch (error) {
    next(error)
  }
})

adminRoutes.get("/security/secret-rotation/status", requireRole(["ADMIN"]), async (_req, res, next) => {
  try {
    const status = await getSecretRotationStatus()
    res.status(200).json({ status })
  } catch (error) {
    next(error)
  }
})

adminRoutes.post("/security/secret-rotation/record", requireRole(["ADMIN"]), async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthenticatedRequest
    const payload = secretRotationRecordSchema.parse(req.body ?? {})

    const recorded = await recordSecretRotationEvent({
      actorId: authReq.user.id,
      ticketId: payload.ticketId,
      secrets: payload.secrets,
      notes: payload.notes,
      rotatedAt: payload.rotatedAt
    })

    await writeAuditLog({
      req,
      res,
      action: "security_secret_rotation_record",
      entity: "security",
      entityId: payload.ticketId,
      details: {
        secrets: payload.secrets,
        rotatedAt: recorded.rotatedAt
      }
    })

    res.status(201).json({ rotation: recorded })
  } catch (error) {
    next(error)
  }
})

adminRoutes.get("/users", requireRole(["ADMIN"]), async (req, res, next) => {
  try {
    const payload = userListSchema.parse(req.query ?? {})
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: payload.limit
    })

    res.status(200).json({
      users: users.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        mfaEnabled: user.mfaEnabled,
        mfaEnrolledAt: user.mfaEnrolledAt,
        createdAt: user.createdAt
      }))
    })
  } catch (error) {
    next(error)
  }
})

adminRoutes.post("/users/:userId/mfa/reset", requireRole(["ADMIN"]), async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthenticatedRequest
    const payload = mfaResetSchema.parse(req.body ?? {})

    const existing = await prisma.user.findUnique({
      where: { id: req.params.userId }
    })
    if (!existing) {
      res.status(404).json({ error: "User not found" })
      return
    }

    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
        mfaBackupCodesHash: [] as never,
        mfaEnrolledAt: null
      }
    })

    await writeAuditLog({
      req,
      res,
      action: "admin_mfa_reset",
      entity: "user",
      entityId: updated.id,
      details: {
        reason: payload.reason,
        actorId: authReq.user.id
      }
    })

    res.status(200).json({
      user: {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        role: updated.role,
        mfaEnabled: updated.mfaEnabled
      }
    })
  } catch (error) {
    next(error)
  }
})

adminRoutes.get("/observability/summary", requireRole(["ADMIN"]), async (req, res, next) => {
  try {
    const payload = observabilitySchema.parse(req.query ?? {})
    const windowStart = new Date(Date.now() - payload.windowMinutes * 60 * 1000)

    const [dlq, authFailures, sttIngest, dispatchTerminal, suggestionDecisionCount, suggestionAcceptedCount, suggestionRemovedCount, sttCorrectionCount, sttSegmentCount, complianceDismissedCount, complianceResolvedCount, complianceActiveCount] = await Promise.all([
      deadLetterSummary(payload.windowMinutes),
      prisma.auditLog.count({
        where: {
          action: {
            in: ["auth_login_failed", "auth_mfa_failed", "auth_refresh_failed"]
          },
          createdAt: { gte: windowStart }
        }
      }),
      prisma.auditLog.findMany({
        where: {
          action: "transcript_audio_ingested",
          createdAt: { gte: windowStart }
        },
        orderBy: { createdAt: "desc" },
        take: 500
      }),
      prisma.dispatchJob.count({
        where: {
          status: { in: [DispatchStatus.DEAD_LETTER, DispatchStatus.FAILED] },
          updatedAt: { gte: windowStart }
        }
      }),
      prisma.codeSelection.count({
        where: {
          createdAt: { gte: windowStart }
        }
      }),
      prisma.codeSelection.count({
        where: {
          createdAt: { gte: windowStart },
          action: {
            in: ["KEEP", "ADD_FROM_SUGGESTION", "MOVE_TO_DIAGNOSIS", "MOVE_TO_DIFFERENTIAL"]
          }
        }
      }),
      prisma.codeSelection.count({
        where: {
          createdAt: { gte: windowStart },
          action: "REMOVE"
        }
      }),
      prisma.auditLog.count({
        where: {
          action: "transcript_segment_corrected",
          createdAt: { gte: windowStart }
        }
      }),
      prisma.transcriptSegment.count({
        where: {
          createdAt: { gte: windowStart }
        }
      }),
      prisma.complianceIssue.count({
        where: {
          dismissedAt: { gte: windowStart }
        }
      }),
      prisma.complianceIssue.count({
        where: {
          resolvedAt: { gte: windowStart }
        }
      }),
      prisma.complianceIssue.count({
        where: {
          status: "ACTIVE"
        }
      })
    ])

    const sttFallbackCount = sttIngest.reduce((count, row) => {
      const details = row.details as { provider?: string } | null
      return details?.provider === "fallback" ? count + 1 : count
    }, 0)

    const sttTotalCount = sttIngest.length
    const sttFallbackRate = sttTotalCount > 0 ? Number((sttFallbackCount / sttTotalCount).toFixed(3)) : 0
    const suggestionAcceptanceRate =
      suggestionDecisionCount > 0 ? Number((suggestionAcceptedCount / suggestionDecisionCount).toFixed(3)) : 0
    const transcriptCorrectionRate = sttSegmentCount > 0 ? Number((sttCorrectionCount / sttSegmentCount).toFixed(3)) : 0
    const complianceReviewedCount = complianceDismissedCount + complianceResolvedCount
    const complianceFalsePositiveRate =
      complianceReviewedCount > 0 ? Number((complianceDismissedCount / complianceReviewedCount).toFixed(3)) : 0

    const suggestionAcceptanceLow =
      suggestionDecisionCount >= env.AI_SUGGESTION_ACCEPTANCE_ALERT_MIN_DECISIONS &&
      suggestionAcceptanceRate < env.AI_SUGGESTION_ACCEPTANCE_ALERT_THRESHOLD
    const transcriptCorrectionHigh =
      sttSegmentCount >= env.AI_TRANSCRIPT_CORRECTION_ALERT_MIN_SEGMENTS &&
      transcriptCorrectionRate > env.AI_TRANSCRIPT_CORRECTION_ALERT_THRESHOLD
    const complianceFalsePositiveHigh =
      complianceReviewedCount >= env.AI_COMPLIANCE_FALSE_POSITIVE_ALERT_MIN_REVIEWED &&
      complianceFalsePositiveRate > env.AI_COMPLIANCE_FALSE_POSITIVE_ALERT_THRESHOLD

    res.status(200).json({
      summary: {
        windowMinutes: payload.windowMinutes,
        dispatch: {
          ...dlq,
          terminalFailures: dispatchTerminal
        },
        stt: {
          ingestCount: sttTotalCount,
          fallbackCount: sttFallbackCount,
          fallbackRate: sttFallbackRate
        },
        auth: {
          failureCount: authFailures
        },
        aiQuality: {
          suggestions: {
            decisionCount: suggestionDecisionCount,
            acceptedCount: suggestionAcceptedCount,
            removedCount: suggestionRemovedCount,
            acceptanceRate: suggestionAcceptanceRate
          },
          transcript: {
            segmentCount: sttSegmentCount,
            correctionCount: sttCorrectionCount,
            correctionRate: transcriptCorrectionRate
          },
          compliance: {
            dismissedCount: complianceDismissedCount,
            resolvedCount: complianceResolvedCount,
            reviewedCount: complianceReviewedCount,
            activeCount: complianceActiveCount,
            falsePositiveRate: complianceFalsePositiveRate
          }
        },
        alerts: {
          dlqThresholdBreached: dlq.deadLetterRecentCount >= env.DISPATCH_DEAD_LETTER_ALERT_THRESHOLD,
          sttFallbackHigh: sttFallbackRate >= 0.3 && sttTotalCount >= 5,
          authFailureBurst: authFailures >= 10,
          suggestionAcceptanceLow,
          transcriptCorrectionHigh,
          complianceFalsePositiveHigh
        }
      }
    })
  } catch (error) {
    next(error)
  }
})

adminRoutes.get("/observability/trends", requireRole(["ADMIN"]), async (req, res, next) => {
  try {
    const payload = observabilityTrendSchema.parse(req.query ?? {})
    const trend = buildObservabilityTrendPoints(payload.windowMinutes, payload.bucketMinutes)
    const windowStart = new Date(trend.startMs)
    const windowEnd = new Date(trend.endMs)
    const acceptedSelectionActions = new Set(["KEEP", "ADD_FROM_SUGGESTION", "MOVE_TO_DIAGNOSIS", "MOVE_TO_DIFFERENTIAL"])

    const [
      dispatchRows,
      sttIngestRows,
      authFailureRows,
      suggestionDecisionRows,
      transcriptCorrectionRows,
      transcriptSegmentRows,
      complianceDismissedRows,
      complianceResolvedRows
    ] = await Promise.all([
      prisma.dispatchJob.findMany({
        where: {
          status: { in: [DispatchStatus.DEAD_LETTER, DispatchStatus.FAILED] },
          updatedAt: { gte: windowStart, lt: windowEnd }
        },
        select: {
          status: true,
          updatedAt: true
        }
      }),
      prisma.auditLog.findMany({
        where: {
          action: "transcript_audio_ingested",
          createdAt: { gte: windowStart, lt: windowEnd }
        },
        select: {
          createdAt: true,
          details: true
        }
      }),
      prisma.auditLog.findMany({
        where: {
          action: {
            in: ["auth_login_failed", "auth_mfa_failed", "auth_refresh_failed"]
          },
          createdAt: { gte: windowStart, lt: windowEnd }
        },
        select: {
          createdAt: true
        }
      }),
      prisma.codeSelection.findMany({
        where: {
          createdAt: { gte: windowStart, lt: windowEnd }
        },
        select: {
          createdAt: true,
          action: true
        }
      }),
      prisma.auditLog.findMany({
        where: {
          action: "transcript_segment_corrected",
          createdAt: { gte: windowStart, lt: windowEnd }
        },
        select: {
          createdAt: true
        }
      }),
      prisma.transcriptSegment.findMany({
        where: {
          createdAt: { gte: windowStart, lt: windowEnd }
        },
        select: {
          createdAt: true
        }
      }),
      prisma.complianceIssue.findMany({
        where: {
          dismissedAt: { gte: windowStart, lt: windowEnd }
        },
        select: {
          dismissedAt: true
        }
      }),
      prisma.complianceIssue.findMany({
        where: {
          resolvedAt: { gte: windowStart, lt: windowEnd }
        },
        select: {
          resolvedAt: true
        }
      })
    ])

    for (const row of dispatchRows) {
      const bucketIndex = resolveBucketIndex(row.updatedAt, trend.startMs, trend.bucketMs, trend.bucketCount)
      if (bucketIndex === null) continue
      trend.points[bucketIndex].dispatch.terminalFailureCount += 1
      if (row.status === DispatchStatus.DEAD_LETTER) {
        trend.points[bucketIndex].dispatch.deadLetterCount += 1
      }
    }

    for (const row of sttIngestRows) {
      const bucketIndex = resolveBucketIndex(row.createdAt, trend.startMs, trend.bucketMs, trend.bucketCount)
      if (bucketIndex === null) continue
      trend.points[bucketIndex].stt.ingestCount += 1
      const details = row.details as { provider?: string } | null
      if (details?.provider === "fallback") {
        trend.points[bucketIndex].stt.fallbackCount += 1
      }
    }

    for (const row of authFailureRows) {
      const bucketIndex = resolveBucketIndex(row.createdAt, trend.startMs, trend.bucketMs, trend.bucketCount)
      if (bucketIndex === null) continue
      trend.points[bucketIndex].auth.failureCount += 1
    }

    for (const row of suggestionDecisionRows) {
      const bucketIndex = resolveBucketIndex(row.createdAt, trend.startMs, trend.bucketMs, trend.bucketCount)
      if (bucketIndex === null) continue
      trend.points[bucketIndex].aiQuality.suggestions.decisionCount += 1
      if (acceptedSelectionActions.has(row.action)) {
        trend.points[bucketIndex].aiQuality.suggestions.acceptedCount += 1
      }
    }

    for (const row of transcriptCorrectionRows) {
      const bucketIndex = resolveBucketIndex(row.createdAt, trend.startMs, trend.bucketMs, trend.bucketCount)
      if (bucketIndex === null) continue
      trend.points[bucketIndex].aiQuality.transcript.correctionCount += 1
    }

    for (const row of transcriptSegmentRows) {
      const bucketIndex = resolveBucketIndex(row.createdAt, trend.startMs, trend.bucketMs, trend.bucketCount)
      if (bucketIndex === null) continue
      trend.points[bucketIndex].aiQuality.transcript.segmentCount += 1
    }

    for (const row of complianceDismissedRows) {
      const bucketIndex = resolveBucketIndex(row.dismissedAt, trend.startMs, trend.bucketMs, trend.bucketCount)
      if (bucketIndex === null) continue
      trend.points[bucketIndex].aiQuality.compliance.dismissedCount += 1
      trend.points[bucketIndex].aiQuality.compliance.reviewedCount += 1
    }

    for (const row of complianceResolvedRows) {
      const bucketIndex = resolveBucketIndex(row.resolvedAt, trend.startMs, trend.bucketMs, trend.bucketCount)
      if (bucketIndex === null) continue
      trend.points[bucketIndex].aiQuality.compliance.resolvedCount += 1
      trend.points[bucketIndex].aiQuality.compliance.reviewedCount += 1
    }

    for (const point of trend.points) {
      point.stt.fallbackRate =
        point.stt.ingestCount > 0 ? Number((point.stt.fallbackCount / point.stt.ingestCount).toFixed(3)) : 0

      point.aiQuality.suggestions.acceptanceRate =
        point.aiQuality.suggestions.decisionCount > 0
          ? Number((point.aiQuality.suggestions.acceptedCount / point.aiQuality.suggestions.decisionCount).toFixed(3))
          : 0

      point.aiQuality.transcript.correctionRate =
        point.aiQuality.transcript.segmentCount > 0
          ? Number((point.aiQuality.transcript.correctionCount / point.aiQuality.transcript.segmentCount).toFixed(3))
          : 0

      point.aiQuality.compliance.falsePositiveRate =
        point.aiQuality.compliance.reviewedCount > 0
          ? Number((point.aiQuality.compliance.dismissedCount / point.aiQuality.compliance.reviewedCount).toFixed(3))
          : 0
    }

    res.status(200).json({
      trends: {
        windowMinutes: payload.windowMinutes,
        bucketMinutes: trend.bucketMinutes,
        start: windowStart.toISOString(),
        end: windowEnd.toISOString(),
        points: trend.points
      }
    })
  } catch (error) {
    next(error)
  }
})
