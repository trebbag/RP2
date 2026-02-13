import type { NextFunction, Response } from "express"
import jwt from "jsonwebtoken"
import type { UserRole } from "@prisma/client"
import { env } from "../config/env.js"
import type { AuthenticatedRequest, AuthUser } from "../types.js"

interface JwtPayload {
  sub: string
  email: string
  name: string
  role: UserRole
}

export function signAuthToken(user: AuthUser): string {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    },
    env.JWT_SECRET,
    { expiresIn: `${env.SESSION_TTL_HOURS}h` }
  )
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

function readBearerToken(req: AuthenticatedRequest): string | null {
  const authHeader = req.headers.authorization
  if (authHeader) {
    const [scheme, token] = authHeader.split(" ")
    if (scheme === "Bearer" && token) return token
  }

  const cookieToken = parseCookieValue(req.headers.cookie, "rp_token")
  if (cookieToken) return cookieToken

  const queryToken = typeof req.query.access_token === "string" ? req.query.access_token : null
  const isSseRequest = req.method === "GET" && req.path.endsWith("/transcript/stream")
  if (isSseRequest && queryToken) return queryToken

  return null
}

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = readBearerToken(req)

  if (!token) {
    res.status(401).json({ error: "Authentication required" })
    return
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload
    req.user = {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      role: payload.role
    }
    next()
  } catch {
    res.status(401).json({ error: "Invalid or expired token" })
  }
}

export function requireRole(roles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: "Insufficient permissions" })
      return
    }

    next()
  }
}
