import { createHmac } from "node:crypto";
import fs from "node:fs/promises";
import https from "node:https";
import net from "node:net";
import { DispatchStatus, DispatchTarget } from "@prisma/client";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { prisma } from "../lib/prisma.js";
import { runWithRls } from "../lib/rls.js";
import { writeSystemAuditLog } from "../middleware/audit.js";
import { sendOperationalAlert } from "./alertingService.js";
import { buildDispatchContract } from "./ehrContractService.js";
const DISPATCH_HTTP_TIMEOUT_MS = 15_000;
const DISPATCH_MLLP_TIMEOUT_MS = 12_000;
let lastDeadLetterAlertAt = 0;
function resolveDispatchTarget() {
    switch (env.DISPATCH_TARGET) {
        case "FHIR_R4":
            return DispatchTarget.FHIR_R4;
        case "HL7_V2":
            return DispatchTarget.HL7_V2;
        case "VENDOR_API":
            return DispatchTarget.VENDOR_API;
        default:
            return DispatchTarget.NONE;
    }
}
function parseJsonSafe(input) {
    try {
        return JSON.parse(input);
    }
    catch {
        return input;
    }
}
function truncateString(value, maxLength = 1500) {
    if (value.length <= maxLength)
        return value;
    return `${value.slice(0, maxLength)}...`;
}
function buildDispatchAuthHeaders(input) {
    const headers = {};
    const vendor = env.DISPATCH_VENDOR;
    // Vendor defaults first.
    if (vendor === "ATHENAHEALTH" && env.DISPATCH_BEARER_TOKEN) {
        headers.Authorization = `Bearer ${env.DISPATCH_BEARER_TOKEN}`;
    }
    else if (vendor === "NEXTGEN" && env.DISPATCH_API_KEY) {
        headers[env.DISPATCH_API_KEY_HEADER || "x-nextgen-api-key"] = env.DISPATCH_API_KEY;
    }
    else if (vendor === "ECLINICALWORKS" && env.DISPATCH_API_KEY) {
        headers[env.DISPATCH_API_KEY_HEADER || "x-ecw-api-key"] = env.DISPATCH_API_KEY;
    }
    // Explicit auth mode overrides/adds on top of vendor defaults.
    switch (env.DISPATCH_AUTH_MODE) {
        case "API_KEY":
            if (!env.DISPATCH_API_KEY) {
                throw new Error("DISPATCH_AUTH_MODE=API_KEY requires DISPATCH_API_KEY");
            }
            headers[env.DISPATCH_API_KEY_HEADER] = env.DISPATCH_API_KEY;
            break;
        case "BEARER":
            if (!env.DISPATCH_BEARER_TOKEN) {
                throw new Error("DISPATCH_AUTH_MODE=BEARER requires DISPATCH_BEARER_TOKEN");
            }
            headers.Authorization = `Bearer ${env.DISPATCH_BEARER_TOKEN}`;
            break;
        case "HMAC": {
            if (!env.DISPATCH_HMAC_SECRET) {
                throw new Error("DISPATCH_AUTH_MODE=HMAC requires DISPATCH_HMAC_SECRET");
            }
            const timestamp = new Date().toISOString();
            const signingInput = `${timestamp}\n${input.target}\n${input.contractType}\n${input.body}`;
            const signature = createHmac("sha256", env.DISPATCH_HMAC_SECRET).update(signingInput).digest("hex");
            headers["x-rp-signature-ts"] = timestamp;
            headers[env.DISPATCH_HMAC_HEADER] = signature;
            break;
        }
        default:
            break;
    }
    return headers;
}
async function sendHttpsDispatchWithClientCert(input) {
    if (!env.DISPATCH_CLIENT_CERT_PATH || !env.DISPATCH_CLIENT_KEY_PATH) {
        throw new Error("Mutual TLS dispatch requires DISPATCH_CLIENT_CERT_PATH and DISPATCH_CLIENT_KEY_PATH");
    }
    const cert = await fs.readFile(env.DISPATCH_CLIENT_CERT_PATH);
    const key = await fs.readFile(env.DISPATCH_CLIENT_KEY_PATH);
    const ca = env.DISPATCH_CLIENT_CA_PATH ? await fs.readFile(env.DISPATCH_CLIENT_CA_PATH) : undefined;
    const parsed = new URL(input.url);
    if (parsed.protocol !== "https:") {
        throw new Error("Client certificate dispatch requires an https URL");
    }
    return new Promise((resolve, reject) => {
        const request = https.request({
            protocol: parsed.protocol,
            hostname: parsed.hostname,
            port: parsed.port || 443,
            path: `${parsed.pathname}${parsed.search}`,
            method: "POST",
            headers: input.headers,
            cert,
            key,
            ca,
            rejectUnauthorized: true,
            timeout: DISPATCH_HTTP_TIMEOUT_MS
        }, (response) => {
            const chunks = [];
            response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
            response.on("end", () => {
                resolve({
                    statusCode: response.statusCode ?? 0,
                    body: Buffer.concat(chunks).toString("utf8"),
                    headers: response.headers
                });
            });
        });
        request.on("timeout", () => {
            request.destroy(new Error("Dispatch request timed out"));
        });
        request.on("error", (error) => reject(error));
        request.write(input.body);
        request.end();
    });
}
async function sendHttpDispatch(input) {
    const baseHeaders = {
        "Content-Type": input.contentType,
        "X-RP-Contract-Type": input.contractType,
        "X-RP-Dispatch-Target": input.target,
        "X-RP-Dispatch-Job-Id": input.jobId,
        "X-RP-Idempotency-Key": input.idempotencyKey,
        "Idempotency-Key": input.idempotencyKey
    };
    if (env.DISPATCH_VENDOR === "NEXTGEN") {
        baseHeaders["X-Request-Id"] = input.idempotencyKey;
    }
    if (env.DISPATCH_VENDOR === "ECLINICALWORKS") {
        baseHeaders["X-Correlation-ID"] = input.idempotencyKey;
    }
    if (env.DISPATCH_VENDOR === "ATHENAHEALTH") {
        baseHeaders["Athena-Idempotency-Key"] = input.idempotencyKey;
    }
    const authHeaders = buildDispatchAuthHeaders({
        body: input.body,
        contractType: input.contractType,
        target: input.target
    });
    const headers = { ...baseHeaders, ...authHeaders };
    const useClientCert = Boolean(env.DISPATCH_CLIENT_CERT_PATH || env.DISPATCH_CLIENT_KEY_PATH);
    let statusCode = 0;
    let rawBody = "";
    let responseHeaders = {};
    if (useClientCert) {
        const response = await sendHttpsDispatchWithClientCert({
            url: input.url,
            body: input.body,
            headers
        });
        statusCode = response.statusCode;
        rawBody = response.body;
        responseHeaders = response.headers;
    }
    else {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), DISPATCH_HTTP_TIMEOUT_MS);
        try {
            const response = await fetch(input.url, {
                method: "POST",
                headers,
                body: input.body,
                signal: controller.signal
            });
            statusCode = response.status;
            rawBody = await response.text();
            responseHeaders = {
                "x-message-id": response.headers.get("x-message-id") ?? undefined,
                "x-request-id": response.headers.get("x-request-id") ?? undefined
            };
        }
        finally {
            clearTimeout(timer);
        }
    }
    const parsedBody = parseJsonSafe(rawBody);
    if (statusCode < 200 || statusCode >= 300) {
        throw new Error(`HTTP dispatch failed (${statusCode}): ${truncateString(rawBody, 350)}`);
    }
    const parsed = typeof parsedBody === "object" && parsedBody !== null ? parsedBody : null;
    const headerMessageId = responseHeaders["x-message-id"];
    const headerRequestId = responseHeaders["x-request-id"];
    const externalMessageIdBody = parsed?.messageId ?? parsed?.externalMessageId ?? null;
    const externalMessageId = typeof headerMessageId === "string"
        ? headerMessageId
        : typeof headerRequestId === "string"
            ? headerRequestId
            : typeof externalMessageIdBody === "string"
                ? externalMessageIdBody
                : null;
    return {
        statusCode,
        body: parsedBody,
        externalMessageId
    };
}
async function sendMllpMessage(message) {
    return new Promise((resolve, reject) => {
        if (!env.DISPATCH_MLLP_HOST || !env.DISPATCH_MLLP_PORT) {
            reject(new Error("MLLP host/port not configured"));
            return;
        }
        const socket = new net.Socket();
        const timeout = setTimeout(() => {
            socket.destroy();
            reject(new Error("MLLP dispatch timed out waiting for ACK"));
        }, DISPATCH_MLLP_TIMEOUT_MS);
        let ack = "";
        socket.on("error", (error) => {
            clearTimeout(timeout);
            reject(error);
        });
        socket.on("data", (chunk) => {
            ack += chunk.toString("utf8");
            if (ack.includes("\u001c\r")) {
                clearTimeout(timeout);
                socket.end();
                const normalized = ack.replace(/^\u000b/, "").replace(/\u001c\r$/, "");
                resolve(normalized);
            }
        });
        socket.connect(env.DISPATCH_MLLP_PORT, env.DISPATCH_MLLP_HOST, () => {
            socket.write(`\u000b${message}\u001c\r`);
        });
    });
}
async function sendDispatchPayload(input) {
    const idempotencyKey = input.payload.dispatchMetadata?.idempotencyKey || input.jobId;
    const payloadWithDispatchMeta = {
        ...input.payload,
        dispatchMetadata: {
            idempotencyKey,
            contractVersion: input.payload.dispatchMetadata?.contractVersion || "v1",
            dispatchedAt: input.payload.dispatchMetadata?.dispatchedAt || new Date().toISOString()
        }
    };
    const contract = buildDispatchContract(payloadWithDispatchMeta);
    if (input.target === DispatchTarget.NONE || contract.contractType === "NONE") {
        return {
            statusCode: 200,
            body: {
                dispatched: false,
                reason: "DISPATCH_TARGET=NONE"
            },
            contractType: contract.contractType,
            externalMessageId: null,
            idempotencyKey
        };
    }
    if (input.target === DispatchTarget.HL7_V2 && env.DISPATCH_MLLP_HOST && env.DISPATCH_MLLP_PORT) {
        const ack = await sendMllpMessage(contract.body);
        const mshMatch = ack.match(/MSA\|AA\|([^\r|]+)/);
        return {
            statusCode: 200,
            body: { ack },
            contractType: contract.contractType,
            externalMessageId: mshMatch?.[1] ?? null,
            idempotencyKey
        };
    }
    if (!env.DISPATCH_WEBHOOK_URL) {
        throw new Error("DISPATCH_WEBHOOK_URL is required for HTTP-based dispatch targets");
    }
    const httpResult = await sendHttpDispatch({
        url: env.DISPATCH_WEBHOOK_URL,
        body: contract.body,
        contentType: contract.contentType,
        contractType: contract.contractType,
        target: input.target,
        jobId: input.jobId,
        idempotencyKey
    });
    return {
        ...httpResult,
        contractType: contract.contractType,
        idempotencyKey
    };
}
function computeNextRetry(attemptCount) {
    const multiplier = 2 ** Math.max(0, attemptCount - 1);
    const delayMs = Math.min(10 * 60_000, env.DISPATCH_BACKOFF_MS * multiplier);
    return new Date(Date.now() + delayMs);
}
export async function enqueueDispatchJob(input) {
    const target = resolveDispatchTarget();
    const contract = buildDispatchContract(input.payload);
    return runWithRls(input.orgId, async () => {
        return prisma.dispatchJob.create({
            data: {
                orgId: input.orgId,
                encounterId: input.encounterId,
                noteId: input.noteId,
                target,
                status: DispatchStatus.PENDING,
                contractType: contract.contractType,
                attemptCount: 0,
                maxAttempts: env.DISPATCH_MAX_ATTEMPTS,
                payload: input.payload,
                createdById: input.createdById
            }
        });
    });
}
export async function attemptDispatchJob(jobId, input) {
    const orgId = input?.orgId;
    const runner = orgId ? (fn) => runWithRls(orgId, fn) : (fn) => fn();
    return runner(async () => {
        const job = await prisma.dispatchJob.findFirst({
            where: {
                id: jobId,
                ...(orgId ? { orgId } : {})
            }
        });
        if (!job)
            return null;
        if (job.status === DispatchStatus.DISPATCHED) {
            return job;
        }
        if (job.status === DispatchStatus.DEAD_LETTER && !input?.force) {
            return job;
        }
        const nextAttempt = job.attemptCount + 1;
        try {
            const result = await sendDispatchPayload({
                payload: job.payload,
                target: job.target,
                jobId: job.id
            });
            await prisma.dispatchJob.updateMany({
                where: { id: job.id, orgId: job.orgId },
                data: {
                    status: DispatchStatus.DISPATCHED,
                    dispatchedAt: new Date(),
                    deadLetteredAt: null,
                    attemptCount: nextAttempt,
                    contractType: result.contractType,
                    externalMessageId: result.externalMessageId,
                    response: {
                        statusCode: result.statusCode,
                        body: result.body,
                        idempotencyKey: result.idempotencyKey
                    },
                    lastError: null,
                    nextRetryAt: null
                }
            });
            await writeSystemAuditLog({
                action: "dispatch_succeeded",
                entity: "dispatch_job",
                entityId: job.id,
                actorId: job.createdById ?? undefined,
                encounterId: job.encounterId,
                orgId: job.orgId,
                details: {
                    attemptCount: nextAttempt,
                    target: job.target,
                    idempotencyKey: result.idempotencyKey
                }
            });
            return prisma.dispatchJob.findFirstOrThrow({
                where: { id: job.id, orgId: job.orgId }
            });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Dispatch failed";
            const exhausted = nextAttempt >= job.maxAttempts;
            const status = exhausted ? DispatchStatus.DEAD_LETTER : DispatchStatus.RETRYING;
            await prisma.dispatchJob.updateMany({
                where: { id: job.id, orgId: job.orgId },
                data: {
                    status,
                    attemptCount: nextAttempt,
                    lastError: message,
                    nextRetryAt: exhausted ? null : computeNextRetry(nextAttempt),
                    deadLetteredAt: exhausted ? new Date() : null,
                    response: {
                        error: message
                    }
                }
            });
            const updated = await prisma.dispatchJob.findFirstOrThrow({
                where: { id: job.id, orgId: job.orgId }
            });
            await writeSystemAuditLog({
                action: exhausted ? "dispatch_failed_terminal" : "dispatch_failed_retrying",
                entity: "dispatch_job",
                entityId: job.id,
                actorId: job.createdById ?? undefined,
                encounterId: job.encounterId,
                orgId: job.orgId,
                details: {
                    status,
                    attemptCount: nextAttempt,
                    maxAttempts: job.maxAttempts,
                    nextRetryAt: updated.nextRetryAt?.toISOString() ?? null,
                    error: message
                }
            });
            return updated;
        }
    });
}
export async function processDueDispatchJobs(limit = 20, orgId) {
    if (!orgId) {
        const orgs = await prisma.organization.findMany({
            select: { id: true },
            orderBy: { createdAt: "asc" },
            take: 500
        });
        const processed = [];
        for (const org of orgs) {
            const results = await processDueDispatchJobs(limit, org.id);
            processed.push(...results);
        }
        return processed;
    }
    const now = new Date();
    return runWithRls(orgId, async () => {
        const dueJobs = await prisma.dispatchJob.findMany({
            where: {
                orgId,
                status: {
                    in: [DispatchStatus.PENDING, DispatchStatus.RETRYING]
                },
                OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }]
            },
            orderBy: { createdAt: "asc" },
            take: limit
        });
        const processed = [];
        for (const job of dueJobs) {
            const result = await attemptDispatchJob(job.id, { orgId });
            if (result)
                processed.push(result);
        }
        return processed;
    });
}
export async function deadLetterSummary(windowMinutes = env.DISPATCH_DEAD_LETTER_ALERT_WINDOW_MINUTES, orgId) {
    if (!orgId) {
        throw new Error("deadLetterSummary requires orgId when RLS is enabled");
    }
    const windowStart = new Date(Date.now() - Math.max(1, windowMinutes) * 60 * 1000);
    const baseWhere = orgId ? { orgId } : {};
    const [deadLetterRecentCount, retryingCount, pendingCount] = await Promise.all([
        prisma.dispatchJob.count({
            where: {
                ...baseWhere,
                status: DispatchStatus.DEAD_LETTER,
                updatedAt: { gte: windowStart }
            }
        }),
        prisma.dispatchJob.count({
            where: { ...baseWhere, status: DispatchStatus.RETRYING }
        }),
        prisma.dispatchJob.count({
            where: { ...baseWhere, status: DispatchStatus.PENDING }
        })
    ]);
    return {
        windowMinutes,
        deadLetterRecentCount,
        retryingCount,
        pendingCount
    };
}
export async function emitDeadLetterAlertIfNeeded() {
    if (env.DISPATCH_DEAD_LETTER_ALERT_THRESHOLD <= 0)
        return;
    const orgs = await prisma.organization.findMany({
        select: { id: true, slug: true, name: true },
        orderBy: { createdAt: "asc" },
        take: 500
    });
    const cooldownMs = env.DISPATCH_DEAD_LETTER_ALERT_COOLDOWN_MINUTES * 60 * 1000;
    const now = Date.now();
    if (now - lastDeadLetterAlertAt < cooldownMs)
        return;
    for (const org of orgs) {
        const summary = await runWithRls(org.id, () => deadLetterSummary(env.DISPATCH_DEAD_LETTER_ALERT_WINDOW_MINUTES, org.id));
        if (summary.deadLetterRecentCount < env.DISPATCH_DEAD_LETTER_ALERT_THRESHOLD)
            continue;
        lastDeadLetterAlertAt = now;
        logger.warn("dispatch.dead_letter_threshold_exceeded", {
            orgId: org.id,
            orgSlug: org.slug,
            orgName: org.name,
            deadLetterRecentCount: summary.deadLetterRecentCount,
            threshold: env.DISPATCH_DEAD_LETTER_ALERT_THRESHOLD,
            windowMinutes: summary.windowMinutes,
            retryingCount: summary.retryingCount,
            pendingCount: summary.pendingCount
        });
        await sendOperationalAlert({
            source: "dispatch-worker",
            event: "dlq-threshold-breach",
            severity: "critical",
            title: `Dispatch DLQ threshold exceeded (${org.slug})`,
            message: `${summary.deadLetterRecentCount} jobs reached dead-letter in the last ${summary.windowMinutes} minutes for ${org.name}.`,
            details: {
                orgId: org.id,
                orgSlug: org.slug,
                threshold: env.DISPATCH_DEAD_LETTER_ALERT_THRESHOLD,
                retryingCount: summary.retryingCount,
                pendingCount: summary.pendingCount
            }
        });
        await writeSystemAuditLog({
            action: "dispatch_dead_letter_alert",
            entity: "dispatch_monitor",
            entityId: `dlq-${org.id}-${new Date().toISOString()}`,
            details: {
                orgId: org.id,
                orgSlug: org.slug,
                orgName: org.name,
                ...summary
            }
        });
        break;
    }
}
export async function listDispatchJobs(input) {
    const take = Math.max(1, Math.min(input.limit ?? 50, 200));
    const where = {
        orgId: input.orgId,
        ...(input.status ? { status: input.status } : {}),
        ...(input.encounterId ? { encounterId: input.encounterId } : {})
    };
    return prisma.dispatchJob.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }],
        take
    });
}
export async function replayDispatchJob(jobId, orgId, actorId) {
    const existing = await prisma.dispatchJob.findFirst({
        where: { id: jobId, orgId }
    });
    if (!existing)
        return null;
    if (existing.status === DispatchStatus.DISPATCHED) {
        throw new Error("Cannot replay a successfully dispatched job");
    }
    await prisma.dispatchJob.updateMany({
        where: { id: jobId, orgId },
        data: {
            status: DispatchStatus.PENDING,
            attemptCount: 0,
            nextRetryAt: null,
            deadLetteredAt: null,
            lastError: null
        }
    });
    await writeSystemAuditLog({
        action: "dispatch_replay_requested",
        entity: "dispatch_job",
        entityId: jobId,
        actorId,
        encounterId: existing.encounterId,
        orgId,
        details: {
            previousStatus: existing.status,
            previousAttemptCount: existing.attemptCount
        }
    });
    return attemptDispatchJob(jobId, { orgId, force: true });
}
export async function markDispatchJobDeadLetter(jobId, orgId, reason, actorId) {
    const existing = await prisma.dispatchJob.findFirst({
        where: { id: jobId, orgId }
    });
    if (!existing)
        return null;
    await prisma.dispatchJob.updateMany({
        where: { id: jobId, orgId },
        data: {
            status: DispatchStatus.DEAD_LETTER,
            deadLetteredAt: new Date(),
            nextRetryAt: null,
            lastError: reason || existing.lastError || "Manually moved to dead-letter queue"
        }
    });
    const updated = await prisma.dispatchJob.findFirstOrThrow({
        where: { id: jobId, orgId }
    });
    await writeSystemAuditLog({
        action: "dispatch_marked_dead_letter",
        entity: "dispatch_job",
        entityId: updated.id,
        actorId,
        encounterId: updated.encounterId,
        orgId,
        details: {
            reason: updated.lastError,
            previousStatus: existing.status
        }
    });
    return updated;
}
//# sourceMappingURL=dispatchService.js.map