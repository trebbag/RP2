import { env } from "../config/env.js"
import { prisma } from "../lib/prisma.js"
import { writeSystemAuditLog } from "../middleware/audit.js"

interface RotationEventInput {
  actorId: string
  ticketId: string
  secrets: string[]
  notes?: string
  rotatedAt?: string
}

export async function recordSecretRotationEvent(input: RotationEventInput) {
  const rotatedAtIso = input.rotatedAt ?? new Date().toISOString()

  await writeSystemAuditLog({
    action: "secret_rotation_recorded",
    entity: "security",
    entityId: input.ticketId,
    actorId: input.actorId,
    details: {
      ticketId: input.ticketId,
      secrets: input.secrets,
      notes: input.notes ?? null,
      rotatedAt: rotatedAtIso
    }
  })

  return {
    ticketId: input.ticketId,
    secrets: input.secrets,
    rotatedAt: rotatedAtIso
  }
}

export async function getSecretRotationStatus() {
  const rows = await prisma.auditLog.findMany({
    where: { action: "secret_rotation_recorded" },
    orderBy: { createdAt: "desc" },
    take: 100
  })

  const lastRotatedAtBySecret = new Map<string, string>()
  for (const row of rows) {
    const details = row.details as { secrets?: string[]; rotatedAt?: string } | null
    const rotatedAt = details?.rotatedAt || row.createdAt.toISOString()
    const secrets = Array.isArray(details?.secrets) ? details?.secrets : []

    for (const secretName of secrets) {
      if (!lastRotatedAtBySecret.has(secretName)) {
        lastRotatedAtBySecret.set(secretName, rotatedAt)
      }
    }
  }

  const maxAgeDays = env.SECRET_ROTATION_MAX_AGE_DAYS
  const nowMs = Date.now()

  const perSecret = Array.from(lastRotatedAtBySecret.entries()).map(([secret, rotatedAt]) => {
    const rotatedMs = new Date(rotatedAt).getTime()
    const ageDays = Number.isFinite(rotatedMs)
      ? Math.floor((nowMs - rotatedMs) / (24 * 60 * 60 * 1000))
      : Number.POSITIVE_INFINITY

    return {
      secret,
      rotatedAt,
      ageDays,
      withinPolicy: Number.isFinite(ageDays) && ageDays <= maxAgeDays
    }
  })

  const staleSecrets = perSecret.filter((item) => !item.withinPolicy)
  const latestRotation = rows[0]

  return {
    policy: {
      maxAgeDays
    },
    latestRotation: latestRotation
      ? {
          ticketId:
            typeof (latestRotation.details as { ticketId?: string } | null)?.ticketId === "string"
              ? (latestRotation.details as { ticketId?: string }).ticketId
              : latestRotation.entityId,
          rotatedAt:
            typeof (latestRotation.details as { rotatedAt?: string } | null)?.rotatedAt === "string"
              ? (latestRotation.details as { rotatedAt?: string }).rotatedAt
              : latestRotation.createdAt.toISOString(),
          actorId: latestRotation.actorId
        }
      : null,
    secretsTracked: perSecret,
    staleSecrets,
    hasRecordedRotation: rows.length > 0
  }
}
