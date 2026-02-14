import { createHash } from "node:crypto"
import type { NextFunction, Request, Response } from "express"
import { ZodError } from "zod"
import { logger } from "../lib/logger.js"
import { PhiViolationError } from "../ai/types.js"
import type { BaseRequest } from "../types.js"

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly details?: unknown
  ) {
    super(message)
    this.name = "ApiError"
  }
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: "Route not found" })
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const baseReq = req as BaseRequest
  const requestId = baseReq.requestId

  if (err instanceof ZodError) {
    res.status(400).json({
      error: "Validation error",
      issues: err.flatten(),
      requestId
    })
    return
  }

  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      error: err.message,
      details: err.details,
      requestId
    })
    return
  }

  if (err instanceof PhiViolationError) {
    res.status(422).json({
      error: "PHI boundary violation",
      details: err.details,
      requestId
    })
    return
  }

  const safeErrorMeta =
    err instanceof Error
      ? {
          name: err.name,
          messageHash: createHash("sha256")
            .update(err.message ?? "")
            .digest("hex"),
          messageLength: (err.message ?? "").length
        }
      : {
          type: typeof err
        }

  logger.error("Unhandled API error", {
    requestId,
    method: req.method,
    path: req.path,
    error: safeErrorMeta
  })

  res.status(500).json({ error: "Internal server error", requestId })
}
