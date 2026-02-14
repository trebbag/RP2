import { env } from "../config/env.js"
import { prisma } from "../lib/prisma.js"

export const TRANSCRIPT_TEXT_REDACTED = "[REDACTED]" as const

type DbClient = Pick<typeof prisma, "encounter" | "transcriptSegment">

interface TranscriptRetentionInput {
  orgId: string
  now?: Date
  dryRun?: boolean
  retentionDays?: number
  client?: DbClient
}

export interface TranscriptRetentionReport {
  retentionDays: number
  cutoffIso: string
  dryRun: boolean
  eligibleEncounterCount: number
  eligibleSegmentCount: number
  redactedSegmentCount: number
}

function getCutoff(now: Date, retentionDays: number): Date {
  return new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000)
}

function resolveClient(client: DbClient | undefined): DbClient {
  return client ?? prisma
}

export async function runTranscriptRetentionPolicy(
  input: TranscriptRetentionInput
): Promise<TranscriptRetentionReport> {
  const now = input.now ?? new Date()
  const retentionDays = input.retentionDays ?? env.TRANSCRIPT_RETENTION_DAYS
  const cutoff = getCutoff(now, retentionDays)
  const dryRun = input.dryRun ?? true
  const client = resolveClient(input.client)

  const eligibleEncounters = await client.encounter.findMany({
    where: {
      orgId: input.orgId,
      status: "FINALIZED",
      finalizedAt: {
        lt: cutoff
      }
    },
    select: { id: true }
  })

  const encounterIds = eligibleEncounters.map((row) => row.id)
  const eligibleEncounterCount = encounterIds.length

  if (eligibleEncounterCount === 0) {
    return {
      retentionDays,
      cutoffIso: cutoff.toISOString(),
      dryRun,
      eligibleEncounterCount: 0,
      eligibleSegmentCount: 0,
      redactedSegmentCount: 0
    }
  }

  const eligibleSegmentCount = await client.transcriptSegment.count({
    where: {
      orgId: input.orgId,
      encounterId: { in: encounterIds },
      text: {
        not: TRANSCRIPT_TEXT_REDACTED
      }
    }
  })

  if (dryRun) {
    return {
      retentionDays,
      cutoffIso: cutoff.toISOString(),
      dryRun: true,
      eligibleEncounterCount,
      eligibleSegmentCount,
      redactedSegmentCount: 0
    }
  }

  const updated = await client.transcriptSegment.updateMany({
    where: {
      orgId: input.orgId,
      encounterId: { in: encounterIds },
      text: {
        not: TRANSCRIPT_TEXT_REDACTED
      }
    },
    data: {
      text: TRANSCRIPT_TEXT_REDACTED
    }
  })

  return {
    retentionDays,
    cutoffIso: cutoff.toISOString(),
    dryRun: false,
    eligibleEncounterCount,
    eligibleSegmentCount,
    redactedSegmentCount: updated.count
  }
}

export async function purgeEncounterTranscriptAfterFinalize(input: {
  orgId: string
  encounterId: string
  retentionDays?: number
  client?: DbClient
}): Promise<{ retentionDays: number; redactedSegmentCount: number }> {
  const retentionDays = input.retentionDays ?? env.TRANSCRIPT_RETENTION_DAYS
  const client = resolveClient(input.client)

  if (retentionDays !== 0) {
    return {
      retentionDays,
      redactedSegmentCount: 0
    }
  }

  const updated = await client.transcriptSegment.updateMany({
    where: {
      orgId: input.orgId,
      encounterId: input.encounterId,
      text: {
        not: TRANSCRIPT_TEXT_REDACTED
      }
    },
    data: {
      text: TRANSCRIPT_TEXT_REDACTED
    }
  })

  return {
    retentionDays,
    redactedSegmentCount: updated.count
  }
}
