import type { Response } from "express"
import jwt from "jsonwebtoken"
import * as oidc from "openid-client"
import { z } from "zod"
import { env } from "../config/env.js"
import { ApiError } from "../middleware/errorHandler.js"

export const OIDC_STATE_COOKIE = "rp_oidc"
export const OIDC_STATE_TTL_SECONDS = 10 * 60

const oidcStateSchema = z.object({
  type: z.literal("oidc_state"),
  state: z.string().min(16),
  nonce: z.string().min(16),
  codeVerifier: z.string().min(32),
  returnTo: z.string().min(1),
  requestedOrgId: z.string().min(3).max(64).optional()
})

export type OidcState = z.infer<typeof oidcStateSchema>

export type OidcClientLike = {
  authorizationUrl: (params: Record<string, unknown>) => string
  callback: (
    redirectUri: string,
    parameters: Record<string, unknown>,
    checks: Record<string, unknown>
  ) => Promise<{ claims: () => Record<string, unknown> }>
}

export type OidcServiceConfig = {
  authMode: "local" | "oidc"
  nodeEnv: "development" | "test" | "production"
  jwtSecret: string
  frontendOrigin: string
  issuerUrl?: string
  clientId?: string
  clientSecret?: string
  redirectUri?: string
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

function resolveFrontendOrigin(frontendOrigin: string): string {
  try {
    const url = new URL(frontendOrigin)
    return url.toString().replace(/\/+$/, "")
  } catch {
    return "http://localhost:5173"
  }
}

export function createOidcService(options?: {
  config?: Partial<OidcServiceConfig>
  getClient?: () => Promise<OidcClientLike>
}) {
  const config: OidcServiceConfig = {
    authMode: options?.config?.authMode ?? env.AUTH_MODE,
    nodeEnv: options?.config?.nodeEnv ?? env.NODE_ENV,
    jwtSecret: options?.config?.jwtSecret ?? env.JWT_SECRET,
    frontendOrigin: resolveFrontendOrigin(options?.config?.frontendOrigin ?? env.CORS_ORIGIN),
    issuerUrl: options?.config?.issuerUrl ?? env.OIDC_ISSUER_URL,
    clientId: options?.config?.clientId ?? env.OIDC_CLIENT_ID,
    clientSecret: options?.config?.clientSecret ?? env.OIDC_CLIENT_SECRET,
    redirectUri: options?.config?.redirectUri ?? env.OIDC_REDIRECT_URI
  }

  let cachedConfigPromise: Promise<oidc.Configuration> | null = null

  const discoverConfig = async () => {
    if (!cachedConfigPromise) {
      if (!config.issuerUrl || !config.clientId || !config.clientSecret) {
        throw new ApiError(500, "OIDC is not configured")
      }

      cachedConfigPromise = oidc.discovery(
        new URL(config.issuerUrl),
        config.clientId,
        undefined,
        oidc.ClientSecretBasic(config.clientSecret)
      )
    }
    return cachedConfigPromise
  }

  const getClient: () => Promise<OidcClientLike> =
    options?.getClient ??
    (async () => {
      const discovered = await discoverConfig()
      return {
        authorizationUrl: (params) => {
          return oidc.buildAuthorizationUrl(discovered, params as Record<string, string>).toString()
        },
        callback: async (redirectUri, parameters, checks) => {
          const url = new URL(redirectUri)
          for (const [key, value] of Object.entries(parameters)) {
            if (typeof value === "string" && value) {
              url.searchParams.set(key, value)
            }
          }

          const tokenSet = await oidc.authorizationCodeGrant(discovered, url, {
            expectedState: typeof checks.state === "string" ? checks.state : undefined,
            expectedNonce: typeof checks.nonce === "string" ? checks.nonce : undefined,
            pkceCodeVerifier: typeof checks.code_verifier === "string" ? checks.code_verifier : undefined
          })

          const idTokenClaims = (tokenSet.claims() ?? {}) as Record<string, unknown>
          let merged = idTokenClaims

          if (!merged.email && typeof tokenSet.access_token === "string" && typeof merged.sub === "string") {
            try {
              const userInfo = (await oidc.fetchUserInfo(discovered, tokenSet.access_token, merged.sub)) as Record<
                string,
                unknown
              >
              merged = {
                ...merged,
                ...userInfo
              }
            } catch {
              // Ignore userinfo failures and fall back to ID token claims only.
            }
          }

          return {
            claims: () => merged
          }
        }
      }
    })

  const buildSafeReturnToUrl = (rawReturnTo: unknown): string => {
    const fallback = config.frontendOrigin
    if (typeof rawReturnTo !== "string" || !rawReturnTo.trim()) return fallback

    const trimmed = rawReturnTo.trim()
    if (trimmed.startsWith("/")) {
      return new URL(trimmed, fallback).toString()
    }

    try {
      const parsed = new URL(trimmed)
      const fallbackUrl = new URL(fallback)
      if (parsed.origin !== fallbackUrl.origin) return fallback
      return parsed.toString()
    } catch {
      return fallback
    }
  }

  const signOidcStateCookie = (payload: OidcState): string => {
    return jwt.sign(payload, config.jwtSecret, { expiresIn: OIDC_STATE_TTL_SECONDS })
  }

  const verifyOidcStateCookie = (token: string): OidcState => {
    const decoded = jwt.verify(token, config.jwtSecret) as unknown
    return oidcStateSchema.parse(decoded)
  }

  const setOidcStateCookie = (res: Response, token: string): void => {
    const secure = config.nodeEnv === "production"
    res.append(
      "Set-Cookie",
      `${OIDC_STATE_COOKIE}=${encodeURIComponent(token)}; Path=/api/auth/oidc; HttpOnly; SameSite=Lax; Max-Age=${OIDC_STATE_TTL_SECONDS}${
        secure ? "; Secure" : ""
      }`
    )
  }

  const clearOidcStateCookie = (res: Response): void => {
    const secure = config.nodeEnv === "production"
    res.append(
      "Set-Cookie",
      `${OIDC_STATE_COOKIE}=; Path=/api/auth/oidc; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`
    )
  }

  const readOidcStateCookie = (cookieHeader: string | undefined): OidcState | null => {
    const raw = parseCookieValue(cookieHeader, OIDC_STATE_COOKIE)
    if (!raw) return null
    try {
      return verifyOidcStateCookie(raw)
    } catch {
      return null
    }
  }

  const buildOidcAuthorizationRedirect = async (input: {
    returnTo?: unknown
    requestedOrgId?: unknown
  }): Promise<{
    url: string
    cookie: string
  }> => {
    if (config.authMode !== "oidc") {
      throw new ApiError(404, "OIDC login is disabled")
    }
    if (!config.issuerUrl || !config.clientId || !config.clientSecret || !config.redirectUri) {
      throw new ApiError(500, "OIDC is not configured")
    }

    const client = await getClient()
    const state = oidc.randomState()
    const nonce = oidc.randomNonce()
    const codeVerifier = oidc.randomPKCECodeVerifier()
    const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier)
    const returnTo = buildSafeReturnToUrl(input.returnTo)

    const requestedOrgId =
      typeof input.requestedOrgId === "string" && input.requestedOrgId.trim() ? input.requestedOrgId.trim() : undefined

    const cookie = signOidcStateCookie({
      type: "oidc_state",
      state,
      nonce,
      codeVerifier,
      returnTo,
      requestedOrgId
    })

    const url = client.authorizationUrl({
      scope: "openid email profile",
      redirect_uri: config.redirectUri,
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: "S256"
    })

    return {
      url,
      cookie
    }
  }

  const redeemOidcCallback = async (input: {
    code: string
    state: string
    cookieHeader: string | undefined
  }): Promise<{
    profile: {
      email: string
      name: string
    }
    returnTo: string
    requestedOrgId?: string
  }> => {
    if (config.authMode !== "oidc") {
      throw new ApiError(404, "OIDC login is disabled")
    }
    if (!config.redirectUri) {
      throw new ApiError(500, "OIDC is not configured")
    }

    const cookie = readOidcStateCookie(input.cookieHeader)
    if (!cookie) {
      throw new ApiError(401, "Missing or expired OIDC state")
    }

    if (input.state !== cookie.state) {
      throw new ApiError(401, "Invalid OIDC state")
    }

    const client = await getClient()
    const tokenSet = await client.callback(
      config.redirectUri,
      {
        code: input.code,
        state: input.state
      },
      {
        state: cookie.state,
        nonce: cookie.nonce,
        code_verifier: cookie.codeVerifier
      }
    )

    const claims = tokenSet.claims()
    const email = typeof (claims as any).email === "string" ? String((claims as any).email) : ""
    const name = typeof (claims as any).name === "string" ? String((claims as any).name) : email.split("@")[0] || "User"

    if (!email) {
      throw new ApiError(403, "OIDC profile is missing required claims")
    }

    return {
      profile: {
        email,
        name
      },
      returnTo: cookie.returnTo,
      requestedOrgId: cookie.requestedOrgId
    }
  }

  return {
    config,
    buildSafeReturnToUrl,
    signOidcStateCookie,
    verifyOidcStateCookie,
    setOidcStateCookie,
    clearOidcStateCookie,
    readOidcStateCookie,
    buildOidcAuthorizationRedirect,
    redeemOidcCallback
  }
}

const defaultService = createOidcService()

export const buildSafeReturnToUrl = defaultService.buildSafeReturnToUrl
export const signOidcStateCookie = defaultService.signOidcStateCookie
export const verifyOidcStateCookie = defaultService.verifyOidcStateCookie
export const setOidcStateCookie = defaultService.setOidcStateCookie
export const clearOidcStateCookie = defaultService.clearOidcStateCookie
export const readOidcStateCookie = defaultService.readOidcStateCookie
export const buildOidcAuthorizationRedirect = defaultService.buildOidcAuthorizationRedirect
export const redeemOidcCallback = defaultService.redeemOidcCallback
