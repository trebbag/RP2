import { createHmac } from "node:crypto"
import fs from "node:fs/promises"
import https from "node:https"
import net from "node:net"
import { DispatchStatus, DispatchTarget, Prisma } from "@prisma/client"
import { env } from "../config/env.js"
import { logger } from "../lib/logger.js"
import { prisma } from "../lib/prisma.js"
import { writeSystemAuditLog } from "../middleware/audit.js"
import { sendOperationalAlert } from "./alertingService.js"
import { buildDispatchContract, type DispatchPayloadInput } from "./ehrContractService.js"

const DISPATCH_HTTP_TIMEOUT_MS = 15_000
const DISPATCH_MLLP_TIMEOUT_MS = 12_000
let lastDeadLetterAlertAt = 0

interface EnqueueDispatchJobInput {
  encounterId: string
  noteId?: string
  payload: DispatchPayloadInput
  createdById?: string
}

interface DispatchResult {
  statusCode: number
  body: unknown
  externalMessageId?: string | null
}

function resolveDispatchTarget(): DispatchTarget {
  switch (env.DISPATCH_TARGET) {
    case "FHIR_R4":
      return DispatchTarget.FHIR_R4
    case "HL7_V2":
      return DispatchTarget.HL7_V2
    case "VENDOR_API":
      return DispatchTarget.VENDOR_API
    default:
      return DispatchTarget.NONE
  }
}

function parseJsonSafe(input: string): unknown {
  try {
    return JSON.parse(input)
  } catch {
    return input
  }
}

function truncateString(value: string, maxLength = 1500): string {
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength)}...`
}

function buildDispatchAuthHeaders(input: {
  body: string
  contractType: string
  target: DispatchTarget
}): Record<string, string> {
  const headers: Record<string, string> = {}
  const vendor = env.DISPATCH_VENDOR

  // Vendor defaults first.
  if (vendor === "ATHENAHEALTH" && env.DISPATCH_BEARER_TOKEN) {
    headers.Authorization = `Bearer ${env.DISPATCH_BEARER_TOKEN}`
  } else if (vendor === "NEXTGEN" && env.DISPATCH_API_KEY) {
    headers[env.DISPATCH_API_KEY_HEADER || "x-nextgen-api-key"] = env.DISPATCH_API_KEY
  } else if (vendor === "ECLINICALWORKS" && env.DISPATCH_API_KEY) {
    headers[env.DISPATCH_API_KEY_HEADER || "x-ecw-api-key"] = env.DISPATCH_API_KEY
  }

  // Explicit auth mode overrides/adds on top of vendor defaults.
  switch (env.DISPATCH_AUTH_MODE) {
    case "API_KEY":
      if (!env.DISPATCH_API_KEY) {
        throw new Error("DISPATCH_AUTH_MODE=API_KEY requires DISPATCH_API_KEY")
      }
      headers[env.DISPATCH_API_KEY_HEADER] = env.DISPATCH_API_KEY
      break
    case "BEARER":
      if (!env.DISPATCH_BEARER_TOKEN) {
        throw new Error("DISPATCH_AUTH_MODE=BEARER requires DISPATCH_BEARER_TOKEN")
      }
      headers.Authorization = `Bearer ${env.DISPATCH_BEARER_TOKEN}`
      break
    case "HMAC": {
      if (!env.DISPATCH_HMAC_SECRET) {
        throw new Error("DISPATCH_AUTH_MODE=HMAC requires DISPATCH_HMAC_SECRET")
      }
      const timestamp = new Date().toISOString()
      const signingInput = `${timestamp}\n${input.target}\n${input.contractType}\n${input.body}`
      const signature = createHmac("sha256", env.DISPATCH_HMAC_SECRET).update(signingInput).digest("hex")
      headers["x-rp-signature-ts"] = timestamp
      headers[env.DISPATCH_HMAC_HEADER] = signature
      break
    }
    default:
      break
  }

  return headers
}

async function sendHttpsDispatchWithClientCert(input: {
  url: string
  body: string
  headers: Record<string, string>
}): Promise<{ statusCode: number; body: string; headers: Record<string, string | string[] | undefined> }> {
  if (!env.DISPATCH_CLIENT_CERT_PATH || !env.DISPATCH_CLIENT_KEY_PATH) {
    throw new Error(
      "Mutual TLS dispatch requires DISPATCH_CLIENT_CERT_PATH and DISPATCH_CLIENT_KEY_PATH"
    )
  }

  const cert = await fs.readFile(env.DISPATCH_CLIENT_CERT_PATH)
  const key = await fs.readFile(env.DISPATCH_CLIENT_KEY_PATH)
  const ca = env.DISPATCH_CLIENT_CA_PATH ? await fs.readFile(env.DISPATCH_CLIENT_CA_PATH) : undefined

  const parsed = new URL(input.url)
  if (parsed.protocol !== "https:") {
    throw new Error("Client certificate dispatch requires an https URL")
  }

  return new Promise((resolve, reject) => {
    const request = https.request(
      {
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
      },
      (response) => {
        const chunks: Buffer[] = []
        response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
        response.on("end", () => {
          resolve({
            statusCode: response.statusCode ?? 0,
            body: Buffer.concat(chunks).toString("utf8"),
            headers: response.headers
          })
        })
      }
    )

    request.on("timeout", () => {
      request.destroy(new Error("Dispatch request timed out"))
    })
    request.on("error", (error) => reject(error))
    request.write(input.body)
    request.end()
  })
}

async function sendHttpDispatch(input: {
  url: string
  body: string
  contentType: string
  contractType: string
  target: DispatchTarget
  jobId: string
  idempotencyKey: string
}): Promise<DispatchResult> {
  const baseHeaders: Record<string, string> = {
    "Content-Type": input.contentType,
    "X-RP-Contract-Type": input.contractType,
    "X-RP-Dispatch-Target": input.target,
    "X-RP-Dispatch-Job-Id": input.jobId,
    "X-RP-Idempotency-Key": input.idempotencyKey,
    "Idempotency-Key": input.idempotencyKey
  }

  if (env.DISPATCH_VENDOR === "NEXTGEN") {
    baseHeaders["X-Request-Id"] = input.idempotencyKey
  }
  if (env.DISPATCH_VENDOR === "ECLINICALWORKS") {
    baseHeaders["X-Correlation-ID"] = input.idempotencyKey
  }
  if (env.DISPATCH_VENDOR === "ATHENAHEALTH") {
    baseHeaders["Athena-Idempotency-Key"] = input.idempotencyKey
  }

  const authHeaders = buildDispatchAuthHeaders({
    body: input.body,
    contractType: input.contractType,
    target: input.target
  })
  const headers = { ...baseHeaders, ...authHeaders }

  const useClientCert = Boolean(env.DISPATCH_CLIENT_CERT_PATH || env.DISPATCH_CLIENT_KEY_PATH)

  let statusCode = 0
  let rawBody = ""
  let responseHeaders: Record<string, string | string[] | undefined> = {}

  if (useClientCert) {
    const response = await sendHttpsDispatchWithClientCert({
      url: input.url,
      body: input.body,
      headers
    })
    statusCode = response.statusCode
    rawBody = response.body
    responseHeaders = response.headers
  } else {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), DISPATCH_HTTP_TIMEOUT_MS)
    try {
      const response = await fetch(input.url, {
        method: "POST",
        headers,
        body: input.body,
        signal: controller.signal
      })
      statusCode = response.status
      rawBody = await response.text()
      responseHeaders = {
        "x-message-id": response.headers.get("x-message-id") ?? undefined,
        "x-request-id": response.headers.get("x-request-id") ?? undefined
      }
    } finally {
      clearTimeout(timer)
    }
  }

  const parsedBody = parseJsonSafe(rawBody)
  if (statusCode < 200 || statusCode >= 300) {
    throw new Error(`HTTP dispatch failed (${statusCode}): ${truncateString(rawBody, 350)}`)
  }

  const parsed = typeof parsedBody === "object" && parsedBody !== null ? (parsedBody as Record<string, unknown>) : null
  const headerMessageId = responseHeaders["x-message-id"]
  const headerRequestId = responseHeaders["x-request-id"]
  const externalMessageIdBody = parsed?.messageId ?? parsed?.externalMessageId ?? null
  const externalMessageId =
    typeof headerMessageId === "string"
      ? headerMessageId
      : typeof headerRequestId === "string"
        ? headerRequestId
        : typeof externalMessageIdBody === "string"
          ? externalMessageIdBody
          : null

  return {
    statusCode,
    body: parsedBody,
    externalMessageId
  }
}

async function sendMllpMessage(message: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!env.DISPATCH_MLLP_HOST || !env.DISPATCH_MLLP_PORT) {
      reject(new Error("MLLP host/port not configured"))
      return
    }

    const socket = new net.Socket()
    const timeout = setTimeout(() => {
      socket.destroy()
      reject(new Error("MLLP dispatch timed out waiting for ACK"))
    }, DISPATCH_MLLP_TIMEOUT_MS)

    let ack = ""

    socket.on("error", (error) => {
      clearTimeout(timeout)
      reject(error)
    })

    socket.on("data", (chunk) => {
      ack += chunk.toString("utf8")
      if (ack.includes("\u001c\r")) {
        clearTimeout(timeout)
        socket.end()
        const normalized = ack.replace(/^\u000b/, "").replace(/\u001c\r$/, "")
        resolve(normalized)
      }
    })

    socket.connect(env.DISPATCH_MLLP_PORT, env.DISPATCH_MLLP_HOST, () => {
      socket.write(`\u000b${message}\u001c\r`)
    })
  })
}

async function sendDispatchPayload(input: {
  payload: DispatchPayloadInput
  target: DispatchTarget
  jobId: string
}): Promise<DispatchResult & { contractType: string; idempotencyKey: string }> {
  const idempotencyKey = input.payload.dispatchMetadata?.idempotencyKey || input.jobId
  const payloadWithDispatchMeta: DispatchPayloadInput = {
    ...input.payload,
    dispatchMetadata: {
      idempotencyKey,
      contractVersion: input.payload.dispatchMetadata?.contractVersion || "v1",
      dispatchedAt: input.payload.dispatchMetadata?.dispatchedAt || new Date().toISOString()
    }
  }
  const contract = buildDispatchContract(payloadWithDispatchMeta)

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
    }
  }

  if (input.target === DispatchTarget.HL7_V2 && env.DISPATCH_MLLP_HOST && env.DISPATCH_MLLP_PORT) {
    const ack = await sendMllpMessage(contract.body)
    const mshMatch = ack.match(/MSA\|AA\|([^\r|]+)/)
    return {
      statusCode: 200,
      body: { ack },
      contractType: contract.contractType,
      externalMessageId: mshMatch?.[1] ?? null,
      idempotencyKey
    }
  }

  if (!env.DISPATCH_WEBHOOK_URL) {
    throw new Error("DISPATCH_WEBHOOK_URL is required for HTTP-based dispatch targets")
  }

  const httpResult = await sendHttpDispatch({
    url: env.DISPATCH_WEBHOOK_URL,
    body: contract.body,
    contentType: contract.contentType,
    contractType: contract.contractType,
    target: input.target,
    jobId: input.jobId,
    idempotencyKey
  })

  return {
    ...httpResult,
    contractType: contract.contractType,
    idempotencyKey
  }
}

function computeNextRetry(attemptCount: number): Date {
  const multiplier = 2 ** Math.max(0, attemptCount - 1)
  const delayMs = Math.min(10 * 60_000, env.DISPATCH_BACKOFF_MS * multiplier)
  return new Date(Date.now() + delayMs)
}

export async function enqueueDispatchJob(input: EnqueueDispatchJobInput) {
  const target = resolveDispatchTarget()
  const contract = buildDispatchContract(input.payload)

  return prisma.dispatchJob.create({
    data: {
      encounterId: input.encounterId,
      noteId: input.noteId,
      target,
      status: DispatchStatus.PENDING,
      contractType: contract.contractType,
      attemptCount: 0,
      maxAttempts: env.DISPATCH_MAX_ATTEMPTS,
      payload: input.payload as never,
      createdById: input.createdById
    }
  })
}

export async function attemptDispatchJob(jobId: string, options?: { force?: boolean }) {
  const job = await prisma.dispatchJob.findUnique({
    where: { id: jobId }
  })
  if (!job) return null

  if (job.status === DispatchStatus.DISPATCHED) {
    return job
  }

  if (job.status === DispatchStatus.DEAD_LETTER && !options?.force) {
    return job
  }

  const nextAttempt = job.attemptCount + 1

  try {
    const result = await sendDispatchPayload({
      payload: job.payload as unknown as DispatchPayloadInput,
      target: job.target,
      jobId: job.id
    })

    const updated = await prisma.dispatchJob.update({
      where: { id: job.id },
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
        } as never,
        lastError: null,
        nextRetryAt: null
      }
    })

    await writeSystemAuditLog({
      action: "dispatch_succeeded",
      entity: "dispatch_job",
      entityId: job.id,
      actorId: job.createdById ?? undefined,
      encounterId: job.encounterId,
      details: {
        attemptCount: nextAttempt,
        target: job.target,
        idempotencyKey: result.idempotencyKey
      }
    })

    return updated
  } catch (error) {
    const message = error instanceof Error ? error.message : "Dispatch failed"
    const exhausted = nextAttempt >= job.maxAttempts
    const status = exhausted ? DispatchStatus.DEAD_LETTER : DispatchStatus.RETRYING
    const updated = await prisma.dispatchJob.update({
      where: { id: job.id },
      data: {
        status,
        attemptCount: nextAttempt,
        lastError: message,
        nextRetryAt: exhausted ? null : computeNextRetry(nextAttempt),
        deadLetteredAt: exhausted ? new Date() : null,
        response: {
          error: message
        } as never
      }
    })

    await writeSystemAuditLog({
      action: exhausted ? "dispatch_failed_terminal" : "dispatch_failed_retrying",
      entity: "dispatch_job",
      entityId: job.id,
      actorId: job.createdById ?? undefined,
      encounterId: job.encounterId,
      details: {
        status,
        attemptCount: nextAttempt,
        maxAttempts: job.maxAttempts,
        nextRetryAt: updated.nextRetryAt?.toISOString() ?? null,
        error: message
      }
    })

    return updated
  }
}

export async function processDueDispatchJobs(limit = 20) {
  const now = new Date()
  const dueJobs = await prisma.dispatchJob.findMany({
    where: {
      status: {
        in: [DispatchStatus.PENDING, DispatchStatus.RETRYING]
      },
      OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }]
    },
    orderBy: { createdAt: "asc" },
    take: limit
  })

  const processed = []
  for (const job of dueJobs) {
    const result = await attemptDispatchJob(job.id)
    if (result) processed.push(result)
  }

  return processed
}

export async function deadLetterSummary(windowMinutes = env.DISPATCH_DEAD_LETTER_ALERT_WINDOW_MINUTES) {
  const windowStart = new Date(Date.now() - Math.max(1, windowMinutes) * 60 * 1000)
  const [deadLetterRecentCount, retryingCount, pendingCount] = await Promise.all([
    prisma.dispatchJob.count({
      where: {
        status: DispatchStatus.DEAD_LETTER,
        updatedAt: { gte: windowStart }
      }
    }),
    prisma.dispatchJob.count({
      where: { status: DispatchStatus.RETRYING }
    }),
    prisma.dispatchJob.count({
      where: { status: DispatchStatus.PENDING }
    })
  ])

  return {
    windowMinutes,
    deadLetterRecentCount,
    retryingCount,
    pendingCount
  }
}

export async function emitDeadLetterAlertIfNeeded() {
  if (env.DISPATCH_DEAD_LETTER_ALERT_THRESHOLD <= 0) return

  const summary = await deadLetterSummary()
  if (summary.deadLetterRecentCount < env.DISPATCH_DEAD_LETTER_ALERT_THRESHOLD) return

  const cooldownMs = env.DISPATCH_DEAD_LETTER_ALERT_COOLDOWN_MINUTES * 60 * 1000
  const now = Date.now()
  if (now - lastDeadLetterAlertAt < cooldownMs) return

  lastDeadLetterAlertAt = now
  logger.warn("dispatch.dead_letter_threshold_exceeded", {
    deadLetterRecentCount: summary.deadLetterRecentCount,
    threshold: env.DISPATCH_DEAD_LETTER_ALERT_THRESHOLD,
    windowMinutes: summary.windowMinutes,
    retryingCount: summary.retryingCount,
    pendingCount: summary.pendingCount
  })

  await sendOperationalAlert({
    source: "dispatch-worker",
    event: "dlq-threshold-breach",
    severity: "critical",
    title: "Dispatch DLQ threshold exceeded",
    message: `${summary.deadLetterRecentCount} jobs reached dead-letter in the last ${summary.windowMinutes} minutes.`,
    details: {
      threshold: env.DISPATCH_DEAD_LETTER_ALERT_THRESHOLD,
      retryingCount: summary.retryingCount,
      pendingCount: summary.pendingCount
    }
  })

  await writeSystemAuditLog({
    action: "dispatch_dead_letter_alert",
    entity: "dispatch_monitor",
    entityId: `dlq-${new Date().toISOString()}`,
    details: summary
  })
}

export async function listDispatchJobs(input?: {
  status?: DispatchStatus
  limit?: number
  encounterId?: string
}) {
  const take = Math.max(1, Math.min(input?.limit ?? 50, 200))
  const where: Prisma.DispatchJobWhereInput = {
    ...(input?.status ? { status: input.status } : {}),
    ...(input?.encounterId ? { encounterId: input.encounterId } : {})
  }

  return prisma.dispatchJob.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }],
    take
  })
}

export async function replayDispatchJob(jobId: string, actorId?: string) {
  const existing = await prisma.dispatchJob.findUnique({
    where: { id: jobId }
  })

  if (!existing) return null
  if (existing.status === DispatchStatus.DISPATCHED) {
    throw new Error("Cannot replay a successfully dispatched job")
  }

  await prisma.dispatchJob.update({
    where: { id: jobId },
    data: {
      status: DispatchStatus.PENDING,
      attemptCount: 0,
      nextRetryAt: null,
      deadLetteredAt: null,
      lastError: null
    }
  })

  await writeSystemAuditLog({
    action: "dispatch_replay_requested",
    entity: "dispatch_job",
    entityId: jobId,
    actorId,
    encounterId: existing.encounterId,
    details: {
      previousStatus: existing.status,
      previousAttemptCount: existing.attemptCount
    }
  })

  return attemptDispatchJob(jobId, { force: true })
}

export async function markDispatchJobDeadLetter(jobId: string, reason: string, actorId?: string) {
  const existing = await prisma.dispatchJob.findUnique({
    where: { id: jobId }
  })

  if (!existing) return null

  const updated = await prisma.dispatchJob.update({
    where: { id: jobId },
    data: {
      status: DispatchStatus.DEAD_LETTER,
      deadLetteredAt: new Date(),
      nextRetryAt: null,
      lastError: reason || existing.lastError || "Manually moved to dead-letter queue"
    }
  })

  await writeSystemAuditLog({
    action: "dispatch_marked_dead_letter",
    entity: "dispatch_job",
    entityId: updated.id,
    actorId,
    encounterId: updated.encounterId,
    details: {
      reason: updated.lastError,
      previousStatus: existing.status
    }
  })

  return updated
}
