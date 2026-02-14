import type { NextFunction, Response } from "express"
import { prismaBase } from "../lib/prisma.js"
import { runWithDbClient } from "../lib/dbSession.js"
import type { AuthenticatedRequest } from "../types.js"

function isLongLivedStreamRequest(req: AuthenticatedRequest): boolean {
  // Keep the event-stream request out of the long-lived transaction wrapper.
  // The handler will explicitly set RLS context for its short DB reads.
  if (req.method !== "GET") return false
  return req.path.endsWith("/transcript/stream")
}

export function requireRlsTenantContext(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const orgId = req.user.orgId
  if (!orgId) {
    next()
    return
  }

  if (isLongLivedStreamRequest(req)) {
    next()
    return
  }

  void prismaBase
    .$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_org', ${orgId}, true)`

      return runWithDbClient(tx, () => {
        return new Promise<void>((resolve) => {
          const done = () => {
            res.off("finish", done)
            res.off("close", done)
            resolve()
          }

          res.once("finish", done)
          res.once("close", done)
          next()
        })
      })
    })
    .catch((error) => next(error))
}
