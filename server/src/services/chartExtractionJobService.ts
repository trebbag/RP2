import path from "node:path"
import { ArtifactType, ChartExtractionJobStatus } from "@prisma/client"
import { prisma } from "../lib/prisma.js"
import { logger } from "../lib/logger.js"
import { runWithRls } from "../lib/rls.js"
import { runWithTenantOrg } from "../lib/tenantContext.js"
import { transactional } from "../lib/transactional.js"
import { extractStructuredChart, persistStructuredChart } from "./chartExtractionService.js"

type ClaimedChartJob = {
  orgId: string
  jobId: string
  chartAssetId: string
  storagePath: string
  fileName: string
  mimeType: string
  encounterId: string | null
  createdById: string | null
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message.slice(0, 500)
  }
  return String(error).slice(0, 500)
}

async function withOrgContext<T>(orgId: string, fn: () => Promise<T>): Promise<T> {
  return runWithTenantOrg(orgId, () => runWithRls(orgId, fn))
}

async function claimNextQueuedJob(): Promise<ClaimedChartJob | null> {
  return transactional(async () => {
    const next = await prisma.chartExtractionJob.findFirst({
      where: { status: ChartExtractionJobStatus.QUEUED },
      orderBy: { createdAt: "asc" },
      include: {
        chartAsset: true
      }
    })

    if (!next) return null

    const claimed = await prisma.chartExtractionJob.updateMany({
      where: {
        id: next.id,
        status: ChartExtractionJobStatus.QUEUED
      },
      data: {
        status: ChartExtractionJobStatus.RUNNING,
        startedAt: new Date(),
        attemptCount: { increment: 1 }
      }
    })

    if (claimed.count === 0) return null

    return {
      orgId: next.orgId,
      jobId: next.id,
      chartAssetId: next.chartAssetId,
      storagePath: next.chartAsset.storagePath,
      fileName: next.chartAsset.fileName,
      mimeType: next.chartAsset.mimeType,
      encounterId: next.chartAsset.encounterId,
      createdById: next.chartAsset.createdById
    }
  })
}

async function markJobFailed(jobId: string, error: unknown): Promise<void> {
  const message = safeErrorMessage(error)

  await transactional(async () => {
    await prisma.chartExtractionJob.update({
      where: { id: jobId },
      data: {
        status: ChartExtractionJobStatus.FAILED,
        finishedAt: new Date(),
        lastError: message
      }
    })
  })
}

async function persistJobSuccess(
  job: ClaimedChartJob,
  extraction: Awaited<ReturnType<typeof extractStructuredChart>>
): Promise<void> {
  let structuredArtifact: {
    filePath: string
    fileName: string
    sizeBytes: number
  } | null = null

  if (job.encounterId) {
    const structuredFileName = `${path.parse(path.basename(job.storagePath)).name}.structured.json`
    const structuredPath = path.resolve(path.dirname(job.storagePath), structuredFileName)
    const sizeBytes = await persistStructuredChart(structuredPath, extraction.extractedJson)
    structuredArtifact = {
      filePath: structuredPath,
      fileName: structuredFileName,
      sizeBytes
    }
  }

  await transactional(async () => {
    await prisma.chartAsset.update({
      where: { id: job.chartAssetId },
      data: {
        rawText: extraction.rawText,
        extractedJson: extraction.extractedJson as never
      }
    })

    if (job.encounterId) {
      const encounter = await prisma.encounter.findUnique({
        where: { id: job.encounterId },
        select: { id: true, note: { select: { id: true } } }
      })

      await prisma.exportArtifact.create({
        data: {
          orgId: job.orgId,
          encounterId: encounter?.id ?? job.encounterId,
          noteId: encounter?.note?.id ?? null,
          type: ArtifactType.STRUCTURED_CHART_JSON,
          filePath: structuredArtifact?.filePath ?? job.storagePath,
          mimeType: "application/json",
          fileName: structuredArtifact?.fileName ?? "chart.structured.json",
          sizeBytes: structuredArtifact?.sizeBytes ?? 0,
          createdById: job.createdById
        }
      })
    }

    await prisma.chartExtractionJob.update({
      where: { id: job.jobId },
      data: {
        status: ChartExtractionJobStatus.SUCCEEDED,
        finishedAt: new Date(),
        lastError: null
      }
    })
  })
}

export async function processQueuedChartExtractionJobsForOrg(
  orgId: string,
  limit: number
): Promise<{ processed: string[]; failed: string[] }> {
  const processed: string[] = []
  const failed: string[] = []

  for (let i = 0; i < limit; i += 1) {
    const job = await withOrgContext(orgId, () => claimNextQueuedJob())
    if (!job) break

    try {
      const extraction = await extractStructuredChart({
        filePath: job.storagePath,
        fileName: job.fileName,
        mimeType: job.mimeType
      })

      logger.info("chartExtraction.job.extracted", {
        jobId: job.jobId,
        chartAssetId: job.chartAssetId,
        mimeType: job.mimeType,
        extractedTextLength: extraction.rawText.length,
        extractionMethod: extraction.extractedJson.extraction.method
      })

      await withOrgContext(orgId, () => persistJobSuccess(job, extraction))
      processed.push(job.jobId)
    } catch (error) {
      failed.push(job.jobId)
      logger.error("chartExtraction.job.failed", {
        jobId: job.jobId,
        chartAssetId: job.chartAssetId,
        message: safeErrorMessage(error)
      })

      await withOrgContext(orgId, () => markJobFailed(job.jobId, error))
    }
  }

  return { processed, failed }
}

export async function processQueuedChartExtractionJobs(
  limitPerOrg: number
): Promise<{ processed: number; failed: number }> {
  const orgs = await prisma.organization.findMany({ select: { id: true } })
  let processed = 0
  let failed = 0

  for (const org of orgs) {
    const result = await processQueuedChartExtractionJobsForOrg(org.id, limitPerOrg)
    processed += result.processed.length
    failed += result.failed.length
  }

  return { processed, failed }
}
