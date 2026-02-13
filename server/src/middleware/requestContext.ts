import { randomUUID } from "node:crypto"
import type { NextFunction, Response } from "express"
import type { BaseRequest } from "../types.js"
import { logger } from "../lib/logger.js"

export function requestContext(req: BaseRequest, res: Response, next: NextFunction): void {
  const requestId = req.header("x-request-id") || randomUUID()
  req.requestId = requestId
  res.setHeader("x-request-id", requestId)

  const start = Date.now()
  logger.info("request.start", {
    requestId,
    method: req.method,
    path: req.path,
    ip: req.ip
  })

  res.on("finish", () => {
    logger.info("request.finish", {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Date.now() - start
    })
  })

  next()
}
