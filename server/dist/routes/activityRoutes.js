import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
const querySchema = z.object({
    limit: z.coerce.number().int().positive().max(300).default(100),
    search: z.string().trim().min(1).max(120).optional(),
    category: z.enum(["documentation", "schedule", "settings", "auth", "system", "backend"]).optional(),
    severity: z.enum(["info", "warning", "error", "success"]).optional(),
    includeBackend: z.coerce.boolean().default(false),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    cursor: z.string().min(8).max(500).optional()
});
function toTitleCase(value) {
    return value
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}
function classifyActivity(action, entity) {
    const lowerAction = action.toLowerCase();
    const lowerEntity = entity.toLowerCase();
    let category = "system";
    if (lowerAction.startsWith("auth_") || lowerEntity === "auth" || lowerEntity === "auth_session") {
        category = "auth";
    }
    else if (lowerAction.startsWith("settings_") || lowerEntity === "user_settings") {
        category = "settings";
    }
    else if (lowerAction.startsWith("appointment_") ||
        lowerEntity === "appointment" ||
        lowerAction.includes("visit") ||
        lowerAction.startsWith("encounter_")) {
        category = "schedule";
    }
    else if (lowerAction.startsWith("note_") ||
        lowerAction.startsWith("wizard_") ||
        lowerAction.startsWith("suggestion_") ||
        lowerAction.startsWith("compliance_") ||
        lowerAction.startsWith("transcript_") ||
        lowerEntity === "note" ||
        lowerEntity === "code_selection") {
        category = "documentation";
    }
    else if (lowerAction.startsWith("dispatch_") ||
        lowerEntity === "dispatch_job" ||
        lowerEntity === "dispatch_monitor" ||
        lowerAction.startsWith("audit_retention")) {
        category = "backend";
    }
    let severity = "info";
    if (lowerAction.includes("failed") || lowerAction.includes("error") || lowerAction.includes("denied")) {
        severity = "error";
    }
    else if (lowerAction.includes("warning") || lowerAction.includes("alert")) {
        severity = "warning";
    }
    else if (lowerAction.includes("created") ||
        lowerAction.includes("updated") ||
        lowerAction.includes("saved") ||
        lowerAction.includes("completed") ||
        lowerAction.includes("succeeded")) {
        severity = "success";
    }
    return { category, severity };
}
function describeActivity(input) {
    const baseAction = toTitleCase(input.action);
    const entity = toTitleCase(input.entity);
    const details = input.details;
    const reasonSuffix = typeof details?.reason === "string" ? ` (${details.reason})` : "";
    return `${baseAction} on ${entity} ${input.entityId}${reasonSuffix}`;
}
function encodeCursor(value) {
    const raw = JSON.stringify({
        createdAt: value.createdAt.toISOString(),
        id: value.id
    });
    return Buffer.from(raw, "utf8").toString("base64url");
}
function decodeCursor(value) {
    try {
        const decoded = Buffer.from(value, "base64url").toString("utf8");
        const parsed = JSON.parse(decoded);
        if (!parsed.createdAt || !parsed.id)
            return null;
        const date = new Date(parsed.createdAt);
        if (Number.isNaN(date.getTime()))
            return null;
        return {
            createdAt: date,
            id: parsed.id
        };
    }
    catch {
        return null;
    }
}
function buildBaseWhere(input) {
    const andClauses = [];
    if (input.role !== "ADMIN") {
        andClauses.push({
            actorId: input.userId
        });
    }
    if (input.query.from || input.query.to) {
        andClauses.push({
            createdAt: {
                ...(input.query.from ? { gte: new Date(input.query.from) } : {}),
                ...(input.query.to ? { lte: new Date(input.query.to) } : {})
            }
        });
    }
    if (input.query.search) {
        andClauses.push({
            OR: [
                { action: { contains: input.query.search, mode: "insensitive" } },
                { entity: { contains: input.query.search, mode: "insensitive" } },
                { entityId: { contains: input.query.search, mode: "insensitive" } }
            ]
        });
    }
    if (andClauses.length === 0) {
        return {};
    }
    return {
        AND: andClauses
    };
}
export const activityRoutes = Router();
activityRoutes.get("/", async (req, res, next) => {
    try {
        const authReq = req;
        const role = authReq.user.role;
        const query = querySchema.parse(req.query ?? {});
        const parsedCursor = query.cursor ? decodeCursor(query.cursor) : null;
        if (query.cursor && !parsedCursor) {
            res.status(400).json({ error: "Invalid activity cursor" });
            return;
        }
        const includeBackend = query.includeBackend && role === "ADMIN";
        const baseWhere = buildBaseWhere({
            userId: authReq.user.id,
            role,
            query
        });
        const scanBatchSize = Math.max(80, Math.min(600, query.limit * 3));
        const maxScanBatches = 8;
        const entries = [];
        let scanCursor = parsedCursor;
        let hasMore = false;
        let scannedRows = 0;
        let lastScannedCursor = scanCursor;
        for (let batch = 0; batch < maxScanBatches && entries.length < query.limit; batch += 1) {
            const whereWithCursor = scanCursor
                ? {
                    AND: [
                        baseWhere,
                        {
                            OR: [
                                {
                                    createdAt: { lt: scanCursor.createdAt }
                                },
                                {
                                    AND: [{ createdAt: scanCursor.createdAt }, { id: { lt: scanCursor.id } }]
                                }
                            ]
                        }
                    ]
                }
                : baseWhere;
            const rows = await prisma.auditLog.findMany({
                where: whereWithCursor,
                orderBy: [{ createdAt: "desc" }, { id: "desc" }],
                take: scanBatchSize,
                include: {
                    actor: true
                }
            });
            if (rows.length === 0) {
                hasMore = false;
                break;
            }
            scannedRows += rows.length;
            let reachedRequestedLimit = false;
            for (const row of rows) {
                const classification = classifyActivity(row.action, row.entity);
                const entry = {
                    id: row.id,
                    timestamp: row.createdAt.toISOString(),
                    action: toTitleCase(row.action),
                    category: classification.category,
                    description: describeActivity({
                        action: row.action,
                        entity: row.entity,
                        entityId: row.entityId,
                        details: row.details
                    }),
                    userId: row.actorId ?? "system",
                    userName: row.actor?.name ?? (row.actorId ? "Unknown User" : "System"),
                    severity: classification.severity,
                    details: row.details ?? undefined,
                    ipAddress: row.ip ?? undefined,
                    userAgent: row.userAgent ?? undefined
                };
                if (!includeBackend && entry.category === "backend")
                    continue;
                if (query.category && entry.category !== query.category)
                    continue;
                if (query.severity && entry.severity !== query.severity)
                    continue;
                entries.push(entry);
                if (entries.length >= query.limit) {
                    reachedRequestedLimit = true;
                    lastScannedCursor = {
                        createdAt: row.createdAt,
                        id: row.id
                    };
                    break;
                }
            }
            if (reachedRequestedLimit) {
                hasMore = true;
                break;
            }
            const lastRow = rows[rows.length - 1];
            scanCursor = { createdAt: lastRow.createdAt, id: lastRow.id };
            lastScannedCursor = scanCursor;
            if (rows.length < scanBatchSize) {
                hasMore = false;
                break;
            }
            hasMore = true;
        }
        if (entries.length < query.limit) {
            hasMore = false;
        }
        res.status(200).json({
            activities: entries,
            pageInfo: {
                requestedLimit: query.limit,
                returned: entries.length,
                hasMore,
                nextCursor: hasMore && lastScannedCursor ? encodeCursor(lastScannedCursor) : null,
                scannedRows
            }
        });
    }
    catch (error) {
        next(error);
    }
});
//# sourceMappingURL=activityRoutes.js.map