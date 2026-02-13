import { prisma } from "../lib/prisma.js";
export async function writeAuditLog(input) {
    const authReq = input.req;
    const requestId = input.req.requestId;
    await prisma.auditLog.create({
        data: {
            actorId: authReq.user?.id,
            encounterId: input.encounterId,
            action: input.action,
            entity: input.entity,
            entityId: input.entityId,
            ip: input.req.ip,
            userAgent: input.req.get("user-agent") ?? undefined,
            details: {
                requestId,
                ...(input.details && typeof input.details === "object" ? input.details : {})
            }
        }
    });
}
export async function writeSystemAuditLog(input) {
    await prisma.auditLog.create({
        data: {
            actorId: input.actorId,
            encounterId: input.encounterId,
            action: input.action,
            entity: input.entity,
            entityId: input.entityId,
            details: input.details && typeof input.details === "object"
                ? input.details
                : undefined
        }
    });
}
//# sourceMappingURL=audit.js.map