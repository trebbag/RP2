import type { Request, Response } from "express"
import type { AuthenticatedRequest } from "../types.js"
import { prisma } from "../lib/prisma.js"
import { SYSTEM_ORG_ID } from "../services/tenantService.js"
import { runWithRls } from "../lib/rls.js"

interface AuditInput {
  req: Request
  res: Response
  action: string
  entity: string
  entityId: string
  encounterId?: string
  details?: unknown
}

interface SystemAuditInput {
  orgId?: string
  action: string
  entity: string
  entityId: string
  actorId?: string
  encounterId?: string
  details?: unknown
}

export async function writeAuditLog(input: AuditInput): Promise<void> {
  const authReq = input.req as Partial<AuthenticatedRequest>
  const requestId = (input.req as { requestId?: string }).requestId
  const orgId = authReq.user?.orgId ?? SYSTEM_ORG_ID

  await runWithRls(orgId, async () => {
    await prisma.auditLog.create({
      data: {
        orgId,
        actorId: authReq.user?.id,
        encounterId: input.encounterId,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        ip: input.req.ip,
        userAgent: input.req.get("user-agent") ?? undefined,
        details: {
          requestId,
          ...(input.details && typeof input.details === "object" ? (input.details as Record<string, unknown>) : {})
        } as never
      }
    })
  })
}

export async function writeSystemAuditLog(input: SystemAuditInput): Promise<void> {
  const orgId = input.orgId ?? SYSTEM_ORG_ID
  await runWithRls(orgId, async () => {
    await prisma.auditLog.create({
      data: {
        orgId,
        actorId: input.actorId,
        encounterId: input.encounterId,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        details: input.details && typeof input.details === "object" ? (input.details as never) : undefined
      }
    })
  })
}
