import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
function getCutoff(now, retentionDays) {
    return new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
}
export async function runAuditRetentionPolicy(input) {
    const now = input.now ?? new Date();
    const retentionDays = env.AUDIT_RETENTION_DAYS;
    const cutoff = getCutoff(now, retentionDays);
    const dryRun = input.dryRun ?? true;
    const eligibleCount = await prisma.auditLog.count({
        where: {
            orgId: input.orgId,
            createdAt: {
                lt: cutoff
            }
        }
    });
    if (dryRun) {
        return {
            retentionDays,
            cutoffIso: cutoff.toISOString(),
            dryRun: true,
            eligibleCount,
            deletedCount: 0
        };
    }
    const deleted = await prisma.auditLog.deleteMany({
        where: {
            orgId: input.orgId,
            createdAt: {
                lt: cutoff
            }
        }
    });
    return {
        retentionDays,
        cutoffIso: cutoff.toISOString(),
        dryRun: false,
        eligibleCount,
        deletedCount: deleted.count
    };
}
//# sourceMappingURL=auditRetentionService.js.map