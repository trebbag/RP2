import type { NextFunction, Response } from "express"
import { prisma } from "../lib/prisma.js"
import { runWithTenantOrg } from "../lib/tenantContext.js"
import type { AuthenticatedRequest } from "../types.js"

export function requireOrgContext(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const orgId = req.user.orgId
  if (!orgId) {
    res.status(401).json({ error: "Organization context missing" })
    return
  }

  void (async () => {
    const membership = await prisma.membership.findUnique({
      where: {
        orgId_userId: {
          orgId,
          userId: req.user.id
        }
      },
      select: {
        role: true,
        orgId: true
      }
    })

    if (!membership) {
      res.status(403).json({ error: "Organization access denied" })
      return
    }

    // Treat role as org-scoped. Any access token role claim is advisory only.
    req.user.role = membership.role
    runWithTenantOrg(orgId, () => next())
  })().catch((error) => next(error))
}
