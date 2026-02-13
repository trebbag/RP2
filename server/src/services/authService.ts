import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto"
import { prisma } from "../lib/prisma.js"

interface RequestMeta {
  ip?: string
  userAgent?: string
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex")
  const key = scryptSync(password, salt, 64)
  return `scrypt$${salt}$${key.toString("hex")}`
}

export function verifyPassword(password: string, hashedPassword: string): boolean {
  const parts = hashedPassword.split("$")
  if (parts.length !== 3 || parts[0] !== "scrypt") return false

  const salt = parts[1]
  const expectedHex = parts[2]
  if (!salt || !expectedHex) return false

  const derived = scryptSync(password, salt, 64)
  const expected = Buffer.from(expectedHex, "hex")
  if (expected.length !== derived.length) return false
  return timingSafeEqual(derived, expected)
}

function hashRefreshToken(token: string): string {
  const secret = process.env.JWT_SECRET ?? "development-refresh-secret-not-for-prod"
  return createHash("sha256")
    .update(token)
    .update("|")
    .update(secret)
    .digest("hex")
}

function createRawRefreshToken(): string {
  return randomBytes(48).toString("base64url")
}

function resolveRefreshSessionExpiry(): Date {
  const ttlHours = Math.max(
    1,
    Number.parseInt(process.env.REFRESH_TOKEN_TTL_HOURS ?? "168", 10)
  )
  return new Date(Date.now() + ttlHours * 60 * 60 * 1000)
}

export async function createRefreshSession(userId: string, meta?: RequestMeta) {
  const token = createRawRefreshToken()
  const refreshTokenHash = hashRefreshToken(token)
  const expiresAt = resolveRefreshSessionExpiry()

  const session = await prisma.authSession.create({
    data: {
      userId,
      refreshTokenHash,
      expiresAt,
      ip: meta?.ip,
      userAgent: meta?.userAgent
    }
  })

  return {
    token,
    session
  }
}

export async function rotateRefreshSession(refreshToken: string, meta?: RequestMeta) {
  const refreshTokenHash = hashRefreshToken(refreshToken)
  const existing = await prisma.authSession.findUnique({
    where: { refreshTokenHash },
    include: { user: true }
  })

  if (!existing || existing.revokedAt || existing.expiresAt.getTime() < Date.now()) {
    return null
  }

  const replacementToken = createRawRefreshToken()
  const replacementHash = hashRefreshToken(replacementToken)
  const nextExpiresAt = resolveRefreshSessionExpiry()

  const nextSession = await prisma.$transaction(async (tx) => {
    await tx.authSession.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() }
    })

    return tx.authSession.create({
      data: {
        userId: existing.userId,
        refreshTokenHash: replacementHash,
        expiresAt: nextExpiresAt,
        ip: meta?.ip,
        userAgent: meta?.userAgent
      }
    })
  })

  return {
    user: existing.user,
    token: replacementToken,
    session: nextSession
  }
}

export async function revokeRefreshSession(refreshToken: string): Promise<void> {
  const refreshTokenHash = hashRefreshToken(refreshToken)
  await prisma.authSession.updateMany({
    where: {
      refreshTokenHash,
      revokedAt: null
    },
    data: {
      revokedAt: new Date()
    }
  })
}

export async function revokeAllUserSessions(userId: string): Promise<void> {
  await prisma.authSession.updateMany({
    where: {
      userId,
      revokedAt: null
    },
    data: {
      revokedAt: new Date()
    }
  })
}
