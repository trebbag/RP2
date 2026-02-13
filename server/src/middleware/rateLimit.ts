import type { NextFunction, Request, Response } from "express"
import { env } from "../config/env.js"
import { writeSystemAuditLog } from "./audit.js"

type KeyResolver = (req: Request) => string

interface RateLimitOptions {
  name: string
  windowMs: number
  maxAttempts: number
  blockMs: number
  keyResolver: KeyResolver
}

interface RateEntry {
  count: number
  windowStartMs: number
  blockedUntilMs: number
}

function scrubIp(ip: string | undefined): string {
  return (ip ?? "unknown-ip").trim().toLowerCase()
}

function resolveAuthIdentity(req: Request): string {
  const email =
    typeof req.body?.email === "string" && req.body.email.trim().length > 0
      ? req.body.email.trim().toLowerCase()
      : "unknown-email"
  return `${scrubIp(req.ip)}|${email}`
}

function resolveRefreshIdentity(req: Request): string {
  return scrubIp(req.ip)
}

function createRateLimiter(options: RateLimitOptions) {
  const store = new Map<string, RateEntry>()

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const now = Date.now()
    const key = options.keyResolver(req)
    const existing = store.get(key)

    if (existing && existing.blockedUntilMs > now) {
      const retryAfterSec = Math.max(1, Math.ceil((existing.blockedUntilMs - now) / 1000))
      res.setHeader("Retry-After", String(retryAfterSec))
      res.status(429).json({
        error: "Too many requests. Try again later.",
        details: {
          limiter: options.name,
          retryAfterSec
        }
      })

      await writeSystemAuditLog({
        action: "auth_rate_limit_blocked",
        entity: "auth",
        entityId: key,
        details: {
          limiter: options.name,
          retryAfterSec,
          ip: req.ip
        }
      })
      return
    }

    const resetNeeded = !existing || now - existing.windowStartMs >= options.windowMs
    const entry: RateEntry = resetNeeded
      ? {
          count: 0,
          windowStartMs: now,
          blockedUntilMs: 0
        }
      : existing

    entry.count += 1

    if (entry.count > options.maxAttempts) {
      entry.blockedUntilMs = now + options.blockMs
      store.set(key, entry)

      const retryAfterSec = Math.max(1, Math.ceil(options.blockMs / 1000))
      res.setHeader("Retry-After", String(retryAfterSec))
      res.status(429).json({
        error: "Too many requests. Try again later.",
        details: {
          limiter: options.name,
          retryAfterSec
        }
      })

      await writeSystemAuditLog({
        action: "auth_rate_limit_triggered",
        entity: "auth",
        entityId: key,
        details: {
          limiter: options.name,
          maxAttempts: options.maxAttempts,
          blockMs: options.blockMs,
          ip: req.ip
        }
      })
      return
    }

    store.set(key, entry)

    if (store.size > 5_000) {
      for (const [entryKey, value] of store.entries()) {
        if (now - value.windowStartMs > options.windowMs * 2 && value.blockedUntilMs <= now) {
          store.delete(entryKey)
        }
      }
    }

    next()
  }
}

export const authLoginRateLimiter = createRateLimiter({
  name: "auth-login",
  windowMs: env.AUTH_LOGIN_WINDOW_SECONDS * 1000,
  maxAttempts: env.AUTH_LOGIN_MAX_ATTEMPTS,
  blockMs: env.AUTH_LOGIN_BLOCK_SECONDS * 1000,
  keyResolver: resolveAuthIdentity
})

export const authRefreshRateLimiter = createRateLimiter({
  name: "auth-refresh",
  windowMs: env.AUTH_REFRESH_WINDOW_SECONDS * 1000,
  maxAttempts: env.AUTH_REFRESH_MAX_ATTEMPTS,
  blockMs: env.AUTH_REFRESH_BLOCK_SECONDS * 1000,
  keyResolver: resolveRefreshIdentity
})
