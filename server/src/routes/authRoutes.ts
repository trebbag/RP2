import { createHash } from "node:crypto"
import type { Response } from "express"
import { Router } from "express"
import jwt from "jsonwebtoken"
import { z } from "zod"
import type { UserRole } from "@prisma/client"
import { env } from "../config/env.js"
import { prisma } from "../lib/prisma.js"
import { authenticate, requireRole, signAuthToken } from "../middleware/auth.js"
import { requireOrgContext } from "../middleware/tenant.js"
import type { AuthenticatedRequest } from "../types.js"
import { ApiError } from "../middleware/errorHandler.js"
import { writeSystemAuditLog } from "../middleware/audit.js"
import {
  createRefreshSession,
  hashPassword,
  revokeAllUserSessions,
  revokeRefreshSession,
  rotateRefreshSession,
  verifyPassword
} from "../services/authService.js"
import {
  buildOtpAuthUrl,
  consumeBackupCode,
  generateBackupCodes,
  generateMfaSecret,
  validatePasswordComplexity,
  verifyTotpCode
} from "../services/securityService.js"
import {
  ensureMembership,
  ensureOrganization,
  ensureTenantBootstrap,
  normalizeOrganizationInput,
  resolveLoginMembership
} from "../services/tenantService.js"
import {
  buildOidcAuthorizationRedirect,
  clearOidcStateCookie,
  redeemOidcCallback,
  setOidcStateCookie
} from "../services/oidcService.js"

export const authRoutes = Router()

const devLoginSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  role: z.enum(["ADMIN", "MA", "CLINICIAN"]).default("CLINICIAN"),
  orgName: z.string().trim().min(2).max(120).optional(),
  orgSlug: z.string().trim().min(2).max(64).optional()
})

const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  password: z.string().min(env.PASSWORD_MIN_LENGTH),
  role: z.enum(["ADMIN", "MA", "CLINICIAN"]).default("CLINICIAN")
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  mfaCode: z.string().optional(),
  backupCode: z.string().optional(),
  orgId: z.string().min(3).max(64).optional()
})

const refreshSchema = z.object({
  refreshToken: z.string().optional()
})

const mfaSetupVerifySchema = z.object({
  mfaCode: z.string().min(6).max(8)
})

const mfaDisableSchema = z.object({
  mfaCode: z.string().optional(),
  backupCode: z.string().optional()
})

const mfaEnrollmentStartSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
})

const mfaEnrollmentCompleteSchema = z.object({
  enrollmentToken: z.string().min(20),
  mfaCode: z.string().min(6).max(8)
})

interface EnrollmentJwtPayload {
  sub: string
  type: "mfa_enroll"
}

function requireLocalAuthEnabled(): void {
  if (env.AUTH_MODE !== "local") {
    throw new ApiError(404, "Local auth is disabled")
  }
}

authRoutes.get("/policy", (_req, res) => {
  res.status(200).json({
    policy: {
      authMode: env.AUTH_MODE,
      passwordMinLength: env.PASSWORD_MIN_LENGTH,
      mfaRequired: env.MFA_REQUIRED,
      allowDevLogin: env.ALLOW_DEV_LOGIN && env.NODE_ENV !== "production"
    }
  })
})

authRoutes.get("/bootstrap-status", async (_req, res, next) => {
  try {
    const userCount = await prisma.user.count()
    res.status(200).json({
      hasUsers: userCount > 0
    })
  } catch (error) {
    next(error)
  }
})

function sanitizeUser(
  user: {
    id: string
    email: string
    name: string
    mfaEnabled?: boolean
  },
  context: {
    role: UserRole
    orgId: string
    orgName?: string | null
    orgSlug?: string | null
  }
) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: context.role,
    orgId: context.orgId,
    orgName: context.orgName ?? null,
    orgSlug: context.orgSlug ?? null,
    mfaEnabled: Boolean(user.mfaEnabled)
  }
}

function readBackupHashes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((item): item is string => typeof item === "string")
}

function parseCookieValue(cookieHeader: string | undefined, key: string): string | null {
  if (!cookieHeader) return null
  const parts = cookieHeader.split(";")
  for (const part of parts) {
    const [name, ...rest] = part.trim().split("=")
    if (name === key) {
      return decodeURIComponent(rest.join("="))
    }
  }
  return null
}

function setRefreshCookie(res: Response, refreshToken: string) {
  const secure = env.NODE_ENV === "production"
  const maxAgeMs = env.REFRESH_TOKEN_TTL_HOURS * 60 * 60 * 1000
  res.append(
    "Set-Cookie",
    `rp_refresh=${encodeURIComponent(refreshToken)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(maxAgeMs / 1000)}${
      secure ? "; Secure" : ""
    }`
  )
}

function clearRefreshCookie(res: Response) {
  const secure = env.NODE_ENV === "production"
  res.append("Set-Cookie", `rp_refresh=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`)
}

function issueAccessToken(
  user: {
    id: string
    email: string
    name: string
  },
  context: {
    role: UserRole
    orgId: string
  }
) {
  return signAuthToken({
    id: user.id,
    email: user.email,
    name: user.name,
    role: context.role,
    orgId: context.orgId
  })
}

function signEnrollmentToken(userId: string): string {
  return jwt.sign(
    {
      sub: userId,
      type: "mfa_enroll"
    } satisfies EnrollmentJwtPayload,
    env.JWT_SECRET,
    { expiresIn: "10m" }
  )
}

function verifyEnrollmentToken(token: string): EnrollmentJwtPayload {
  const parsed = jwt.verify(token, env.JWT_SECRET) as Partial<EnrollmentJwtPayload>
  if (!parsed?.sub || parsed.type !== "mfa_enroll") {
    throw new ApiError(401, "Invalid MFA enrollment token")
  }
  return parsed as EnrollmentJwtPayload
}

authRoutes.post("/register-first", async (req, res, next) => {
  try {
    requireLocalAuthEnabled()
    await ensureTenantBootstrap()
    const usersCount = await prisma.user.count()
    if (usersCount > 0) {
      throw new ApiError(403, "Bootstrap registration is disabled after initial user creation")
    }

    const payload = registerSchema.parse(req.body)
    const passwordCheck = validatePasswordComplexity(payload.password)
    if (!passwordCheck.valid) {
      throw new ApiError(422, "Password does not meet complexity policy", {
        issues: passwordCheck.issues
      })
    }
    const user = await prisma.user.create({
      data: {
        email: payload.email,
        name: payload.name,
        role: payload.role as UserRole,
        passwordHash: hashPassword(payload.password)
      }
    })

    const organization = await ensureOrganization({ slug: "default", name: "Default Organization" })
    const membership = await ensureMembership({
      orgId: organization.id,
      userId: user.id,
      role: payload.role as UserRole
    })

    const accessToken = issueAccessToken(user, { role: membership.role, orgId: membership.orgId })
    const refresh = await createRefreshSession(user.id, membership.orgId, {
      ip: req.ip,
      userAgent: req.get("user-agent") ?? undefined
    })
    setRefreshCookie(res, refresh.token)

    res.status(201).json({
      token: accessToken,
      user: sanitizeUser(user, {
        role: membership.role,
        orgId: membership.orgId,
        orgName: organization.name,
        orgSlug: organization.slug
      })
    })
  } catch (error) {
    next(error)
  }
})

authRoutes.post("/register", authenticate, requireOrgContext, requireRole(["ADMIN"]), async (req, res, next) => {
  try {
    requireLocalAuthEnabled()
    const authReq = req as unknown as AuthenticatedRequest
    const payload = registerSchema.parse(req.body)
    const passwordCheck = validatePasswordComplexity(payload.password)
    if (!passwordCheck.valid) {
      throw new ApiError(422, "Password does not meet complexity policy", {
        issues: passwordCheck.issues
      })
    }

    const user = await prisma.user.create({
      data: {
        email: payload.email,
        name: payload.name,
        role: payload.role as UserRole,
        passwordHash: hashPassword(payload.password)
      }
    })

    await ensureMembership({
      orgId: authReq.user.orgId,
      userId: user.id,
      role: payload.role as UserRole
    })

    const orgRecord = await prisma.organization.findUnique({
      where: { id: authReq.user.orgId },
      select: { name: true, slug: true }
    })

    res.status(201).json({
      user: sanitizeUser(user, {
        role: payload.role as UserRole,
        orgId: authReq.user.orgId,
        orgName: orgRecord?.name ?? null,
        orgSlug: orgRecord?.slug ?? null
      })
    })
  } catch (error) {
    next(error)
  }
})

authRoutes.post("/login", async (req, res, next) => {
  try {
    requireLocalAuthEnabled()
    await ensureTenantBootstrap()
    const payload = loginSchema.parse(req.body)
    const user = await prisma.user.findUnique({
      where: { email: payload.email }
    })

    if (!user || !user.passwordHash || !verifyPassword(payload.password, user.passwordHash)) {
      await writeSystemAuditLog({
        action: "auth_login_failed",
        entity: "auth",
        entityId: payload.email,
        details: {
          reason: "invalid_credentials",
          ip: req.ip
        }
      })
      throw new ApiError(401, "Invalid email or password")
    }

    const requiresMfa = user.mfaEnabled || env.MFA_REQUIRED
    if (requiresMfa && !user.mfaEnabled) {
      await writeSystemAuditLog({
        action: "auth_login_failed",
        entity: "auth",
        entityId: user.id,
        actorId: user.id,
        details: {
          reason: "mfa_enrollment_required",
          ip: req.ip
        }
      })
      throw new ApiError(403, "MFA enrollment required for this environment", {
        mfaEnrollmentRequired: true
      })
    }

    if (requiresMfa) {
      let mfaValid = false

      if (payload.mfaCode && user.mfaSecret) {
        mfaValid = verifyTotpCode(user.mfaSecret, payload.mfaCode)
      }

      if (!mfaValid && payload.backupCode) {
        const backupHashes = readBackupHashes(user.mfaBackupCodesHash)
        const consumed = consumeBackupCode(payload.backupCode, backupHashes)
        if (consumed.valid) {
          mfaValid = true
          await prisma.user.update({
            where: { id: user.id },
            data: {
              mfaBackupCodesHash: consumed.remainingHashed as never
            }
          })
        }
      }

      if (!mfaValid) {
        await writeSystemAuditLog({
          action: "auth_mfa_failed",
          entity: "auth",
          entityId: user.id,
          actorId: user.id,
          details: {
            reason: "mfa_verification_required",
            ip: req.ip
          }
        })
        throw new ApiError(401, "MFA verification required", {
          mfaRequired: true
        })
      }
    }

    const membership = await resolveLoginMembership({
      userId: user.id,
      requestedOrgId: payload.orgId
    })

    if (!membership) {
      const memberships = await prisma.membership.findMany({
        where: {
          userId: user.id
        },
        include: {
          organization: {
            select: { id: true, slug: true, name: true }
          }
        },
        orderBy: { createdAt: "asc" },
        take: 10
      })

      throw new ApiError(409, "Organization selection required", {
        orgSelectionRequired: true,
        organizations: memberships.map((row) => ({
          id: row.organization.id,
          slug: row.organization.slug,
          name: row.organization.name,
          role: row.role
        }))
      })
    }

    const refresh = await createRefreshSession(user.id, membership.orgId, {
      ip: req.ip,
      userAgent: req.get("user-agent") ?? undefined
    })
    setRefreshCookie(res, refresh.token)

    const token = issueAccessToken(user, { role: membership.role, orgId: membership.orgId })
    res.status(200).json({
      token,
      user: sanitizeUser(user, {
        role: membership.role,
        orgId: membership.orgId,
        orgName: membership.organization.name,
        orgSlug: membership.organization.slug
      })
    })
  } catch (error) {
    next(error)
  }
})

authRoutes.post("/mfa/enroll/start", async (req, res, next) => {
  try {
    requireLocalAuthEnabled()
    if (!env.MFA_REQUIRED) {
      throw new ApiError(409, "MFA enrollment flow is available only when MFA_REQUIRED=true")
    }

    const payload = mfaEnrollmentStartSchema.parse(req.body)
    const user = await prisma.user.findUnique({
      where: { email: payload.email }
    })

    if (!user || !user.passwordHash || !verifyPassword(payload.password, user.passwordHash)) {
      await writeSystemAuditLog({
        action: "auth_login_failed",
        entity: "auth",
        entityId: payload.email,
        details: {
          reason: "invalid_credentials_mfa_enroll_start",
          ip: req.ip
        }
      })
      throw new ApiError(401, "Invalid email or password")
    }

    if (user.mfaEnabled) {
      throw new ApiError(409, "MFA is already enabled for this user")
    }

    const secret = generateMfaSecret()
    const otpAuthUrl = buildOtpAuthUrl({ email: user.email, secret })

    await prisma.user.update({
      where: { id: user.id },
      data: {
        mfaSecret: secret,
        mfaEnabled: false,
        mfaBackupCodesHash: [] as never
      }
    })

    const enrollmentToken = signEnrollmentToken(user.id)

    await writeSystemAuditLog({
      action: "auth_mfa_enrollment_start",
      entity: "auth",
      entityId: user.id,
      actorId: user.id,
      details: {
        email: user.email,
        ip: req.ip
      }
    })

    res.status(200).json({
      enrollmentToken,
      setup: {
        secret,
        otpAuthUrl,
        issuer: env.MFA_ISSUER
      }
    })
  } catch (error) {
    next(error)
  }
})

authRoutes.post("/mfa/enroll/complete", async (req, res, next) => {
  try {
    requireLocalAuthEnabled()
    if (!env.MFA_REQUIRED) {
      throw new ApiError(409, "MFA enrollment flow is available only when MFA_REQUIRED=true")
    }

    await ensureTenantBootstrap()

    const payload = mfaEnrollmentCompleteSchema.parse(req.body)
    const enrollment = verifyEnrollmentToken(payload.enrollmentToken)

    const user = await prisma.user.findUnique({
      where: { id: enrollment.sub }
    })

    if (!user || !user.mfaSecret) {
      throw new ApiError(409, "MFA setup has not been initialized for this user")
    }

    if (!verifyTotpCode(user.mfaSecret, payload.mfaCode)) {
      await writeSystemAuditLog({
        action: "auth_mfa_failed",
        entity: "auth",
        entityId: user.id,
        actorId: user.id,
        details: {
          reason: "invalid_enrollment_code",
          ip: req.ip
        }
      })
      throw new ApiError(401, "Invalid MFA code")
    }

    const backupCodes = generateBackupCodes(8)
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        mfaEnabled: true,
        mfaEnrolledAt: new Date(),
        mfaBackupCodesHash: backupCodes.hashed as never
      }
    })

    const membership = await resolveLoginMembership({
      userId: updated.id
    })

    if (!membership) {
      throw new ApiError(409, "Organization selection required", {
        orgSelectionRequired: true
      })
    }

    const accessToken = issueAccessToken(updated, { role: membership.role, orgId: membership.orgId })
    const refresh = await createRefreshSession(updated.id, membership.orgId, {
      ip: req.ip,
      userAgent: req.get("user-agent") ?? undefined
    })
    setRefreshCookie(res, refresh.token)

    await writeSystemAuditLog({
      action: "auth_mfa_enrollment_complete",
      entity: "auth",
      entityId: updated.id,
      actorId: updated.id,
      orgId: membership.orgId,
      details: {
        email: updated.email,
        ip: req.ip
      }
    })

    res.status(200).json({
      token: accessToken,
      user: sanitizeUser(updated, {
        role: membership.role,
        orgId: membership.orgId,
        orgName: membership.organization.name,
        orgSlug: membership.organization.slug
      }),
      backupCodes: backupCodes.plain
    })
  } catch (error) {
    next(error)
  }
})

authRoutes.post("/refresh", async (req, res, next) => {
  try {
    await ensureTenantBootstrap()
    const body = refreshSchema.parse(req.body ?? {})
    const cookieToken = parseCookieValue(req.headers.cookie, "rp_refresh")
    const refreshToken = body.refreshToken ?? cookieToken
    if (!refreshToken) {
      throw new ApiError(401, "Refresh token is required")
    }

    const rotated = await rotateRefreshSession(refreshToken, {
      ip: req.ip,
      userAgent: req.get("user-agent") ?? undefined
    })

    if (!rotated) {
      await writeSystemAuditLog({
        action: "auth_refresh_failed",
        entity: "auth",
        entityId: "refresh",
        details: {
          reason: "invalid_or_expired_refresh",
          ip: req.ip
        }
      })
      throw new ApiError(401, "Invalid or expired refresh session")
    }

    const membership = await prisma.membership.findUnique({
      where: {
        orgId_userId: {
          orgId: rotated.orgId,
          userId: rotated.user.id
        }
      },
      include: { organization: true }
    })

    if (!membership) {
      throw new ApiError(403, "Organization access denied")
    }

    setRefreshCookie(res, rotated.token)
    const token = issueAccessToken(rotated.user, { role: membership.role, orgId: membership.orgId })

    res.status(200).json({
      token,
      user: sanitizeUser(rotated.user, {
        role: membership.role,
        orgId: membership.orgId,
        orgName: membership.organization.name,
        orgSlug: membership.organization.slug
      })
    })
  } catch (error) {
    next(error)
  }
})

authRoutes.post("/logout", async (req, res, next) => {
  try {
    const body = refreshSchema.parse(req.body ?? {})
    const cookieToken = parseCookieValue(req.headers.cookie, "rp_refresh")
    const refreshToken = body.refreshToken ?? cookieToken
    if (refreshToken) {
      await revokeRefreshSession(refreshToken)
    }
    clearRefreshCookie(res)
    res.status(200).json({ success: true })
  } catch (error) {
    next(error)
  }
})

authRoutes.post("/logout-all", authenticate, async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthenticatedRequest
    await revokeAllUserSessions(authReq.user.id)
    clearRefreshCookie(res)
    res.status(200).json({ success: true })
  } catch (error) {
    next(error)
  }
})

authRoutes.post("/mfa/setup", authenticate, async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthenticatedRequest
    const user = await prisma.user.findUnique({
      where: { id: authReq.user.id }
    })
    if (!user) {
      throw new ApiError(404, "User not found")
    }

    const secret = generateMfaSecret()
    const otpAuthUrl = buildOtpAuthUrl({ email: user.email, secret })

    await prisma.user.update({
      where: { id: user.id },
      data: {
        mfaSecret: secret,
        mfaEnabled: false,
        mfaBackupCodesHash: [] as never
      }
    })

    res.status(200).json({
      setup: {
        secret,
        otpAuthUrl,
        issuer: env.MFA_ISSUER
      }
    })
  } catch (error) {
    next(error)
  }
})

authRoutes.post("/mfa/enable", authenticate, async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthenticatedRequest
    const payload = mfaSetupVerifySchema.parse(req.body)
    const user = await prisma.user.findUnique({
      where: { id: authReq.user.id }
    })

    if (!user || !user.mfaSecret) {
      throw new ApiError(409, "MFA setup has not been initialized")
    }

    if (!verifyTotpCode(user.mfaSecret, payload.mfaCode)) {
      throw new ApiError(401, "Invalid MFA code")
    }

    const backupCodes = generateBackupCodes(8)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        mfaEnabled: true,
        mfaEnrolledAt: new Date(),
        mfaBackupCodesHash: backupCodes.hashed as never
      }
    })

    res.status(200).json({
      enabled: true,
      backupCodes: backupCodes.plain
    })
  } catch (error) {
    next(error)
  }
})

authRoutes.post("/mfa/backup-codes/regenerate", authenticate, async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthenticatedRequest
    const payload = mfaSetupVerifySchema.parse(req.body)
    const user = await prisma.user.findUnique({
      where: { id: authReq.user.id }
    })

    if (!user || !user.mfaEnabled || !user.mfaSecret) {
      throw new ApiError(409, "MFA is not enabled")
    }

    if (!verifyTotpCode(user.mfaSecret, payload.mfaCode)) {
      throw new ApiError(401, "Invalid MFA code")
    }

    const backupCodes = generateBackupCodes(8)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        mfaBackupCodesHash: backupCodes.hashed as never
      }
    })

    res.status(200).json({
      backupCodes: backupCodes.plain
    })
  } catch (error) {
    next(error)
  }
})

authRoutes.post("/mfa/disable", authenticate, async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthenticatedRequest
    const payload = mfaDisableSchema.parse(req.body ?? {})
    const user = await prisma.user.findUnique({
      where: { id: authReq.user.id }
    })

    if (!user || !user.mfaEnabled) {
      throw new ApiError(409, "MFA is not enabled")
    }

    let valid = false
    if (payload.mfaCode && user.mfaSecret) {
      valid = verifyTotpCode(user.mfaSecret, payload.mfaCode)
    }

    if (!valid && payload.backupCode) {
      const backupHashes = readBackupHashes(user.mfaBackupCodesHash)
      const consumed = consumeBackupCode(payload.backupCode, backupHashes)
      valid = consumed.valid
      if (consumed.valid) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            mfaBackupCodesHash: consumed.remainingHashed as never
          }
        })
      }
    }

    if (!valid) {
      throw new ApiError(401, "MFA verification required to disable MFA")
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
        mfaBackupCodesHash: [] as never,
        mfaEnrolledAt: null
      }
    })

    res.status(200).json({ enabled: false })
  } catch (error) {
    next(error)
  }
})

authRoutes.post("/dev-login", async (req, res, next) => {
  try {
    if (!env.ALLOW_DEV_LOGIN || env.NODE_ENV === "production") {
      throw new ApiError(404, "Dev login is disabled")
    }

    await ensureTenantBootstrap()
    const payload = devLoginSchema.parse(req.body)
    const orgInput = normalizeOrganizationInput({
      orgName: payload.orgName,
      orgSlug: payload.orgSlug
    })

    const user = await prisma.user.upsert({
      where: { email: payload.email },
      update: {
        name: payload.name,
        role: payload.role as UserRole
      },
      create: {
        email: payload.email,
        name: payload.name,
        role: payload.role as UserRole
      }
    })

    const organization = await ensureOrganization({
      slug: orgInput.slug,
      name: orgInput.name
    })

    const membership = await ensureMembership({
      orgId: organization.id,
      userId: user.id,
      role: payload.role as UserRole
    })

    const token = issueAccessToken(user, { role: membership.role, orgId: membership.orgId })
    const refresh = await createRefreshSession(user.id, membership.orgId, {
      ip: req.ip,
      userAgent: req.get("user-agent") ?? undefined
    })
    setRefreshCookie(res, refresh.token)

    res.status(200).json({
      token,
      user: sanitizeUser(user, {
        role: membership.role,
        orgId: membership.orgId,
        orgName: organization.name,
        orgSlug: organization.slug
      })
    })
  } catch (error) {
    next(error)
  }
})

authRoutes.get("/oidc/login", async (req, res, next) => {
  try {
    const { url, cookie } = await buildOidcAuthorizationRedirect({
      returnTo: req.query.returnTo,
      requestedOrgId: req.query.orgId
    })
    setOidcStateCookie(res, cookie)
    res.redirect(url)
  } catch (error) {
    next(error)
  }
})

authRoutes.get("/oidc/callback", async (req, res, next) => {
  try {
    const code = typeof req.query.code === "string" ? req.query.code : null
    const state = typeof req.query.state === "string" ? req.query.state : null
    if (!code || !state) {
      throw new ApiError(400, "Missing OIDC callback parameters")
    }

    await ensureTenantBootstrap()

    const { profile, returnTo, requestedOrgId } = await redeemOidcCallback({
      code,
      state,
      cookieHeader: req.headers.cookie
    })

    let user = await prisma.user.findUnique({
      where: { email: profile.email }
    })

    if (!user) {
      const existingCount = await prisma.user.count()
      const bootstrapRole: UserRole = existingCount === 0 ? "ADMIN" : "CLINICIAN"
      user = await prisma.user.create({
        data: {
          email: profile.email,
          name: profile.name,
          role: bootstrapRole
        }
      })
    } else if (profile.name && profile.name !== user.name) {
      // Keep names reasonably current from IdP without overwriting intentional edits too often.
      await prisma.user.update({
        where: { id: user.id },
        data: {
          name: profile.name
        }
      })
    }

    const membership = await resolveLoginMembership({
      userId: user.id,
      requestedOrgId: requestedOrgId || undefined
    })

    if (!membership) {
      const organization = await ensureOrganization({ slug: "default", name: "Default Organization" })
      const role: UserRole = user.role === "ADMIN" ? "ADMIN" : "CLINICIAN"
      await ensureMembership({
        orgId: organization.id,
        userId: user.id,
        role
      })
    }

    const finalMembership = await resolveLoginMembership({
      userId: user.id,
      requestedOrgId: requestedOrgId || undefined
    })

    if (!finalMembership) {
      throw new ApiError(409, "Organization selection required", {
        orgSelectionRequired: true
      })
    }

    const refresh = await createRefreshSession(user.id, finalMembership.orgId, {
      ip: req.ip,
      userAgent: req.get("user-agent") ?? undefined
    })
    setRefreshCookie(res, refresh.token)
    clearOidcStateCookie(res)

    await writeSystemAuditLog({
      action: "auth_oidc_login",
      entity: "auth",
      entityId: user.id,
      actorId: user.id,
      orgId: finalMembership.orgId,
      details: {
        provider: env.OIDC_ISSUER_URL ? new URL(env.OIDC_ISSUER_URL).origin : "unknown",
        emailHash: createHash("sha256").update(user.email).digest("hex"),
        ip: req.ip
      }
    })

    // Redirect back to frontend. The SPA will call /api/auth/refresh to obtain an access token.
    res.redirect(returnTo)
  } catch (error) {
    next(error)
  }
})

authRoutes.get("/me", authenticate, requireOrgContext, async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthenticatedRequest
    const membership = await prisma.membership.findUnique({
      where: {
        orgId_userId: {
          orgId: authReq.user.orgId,
          userId: authReq.user.id
        }
      },
      include: {
        organization: {
          select: { name: true, slug: true }
        }
      }
    })

    if (!membership) {
      res.status(403).json({ error: "Organization access denied" })
      return
    }

    const user = await prisma.user.findUnique({ where: { id: authReq.user.id } })

    if (!user) {
      res.status(200).json({
        user: sanitizeUser(authReq.user, {
          role: membership.role,
          orgId: membership.orgId,
          orgName: membership.organization.name,
          orgSlug: membership.organization.slug
        }),
        source: "token"
      })
      return
    }

    res.status(200).json({
      user: sanitizeUser(user, {
        role: membership.role,
        orgId: membership.orgId,
        orgName: membership.organization.name,
        orgSlug: membership.organization.slug
      }),
      source: "database"
    })
  } catch (error) {
    next(error)
  }
})
