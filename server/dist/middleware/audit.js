import { prisma } from "../lib/prisma.js";
import { SYSTEM_ORG_ID } from "../services/tenantService.js";
import { runWithRls } from "../lib/rls.js";
export async function writeAuditLog(input) {
    const authReq = input.req;
    const requestId = input.req.requestId;
    const orgId = authReq.user?.orgId ?? SYSTEM_ORG_ID;
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
                    ...(input.details && typeof input.details === "object" ? input.details : {})
                }
            }
        });
    });
}
export async function writeSystemAuditLog(input) {
    const orgId = input.orgId ?? SYSTEM_ORG_ID;
    await runWithRls(orgId, async () => {
        await prisma.auditLog.create({
            data: {
                orgId,
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
    });
}
//# sourceMappingURL=audit.js.map