import path from "node:path"
import { config } from "dotenv"
import { z } from "zod"

config({ path: path.resolve(process.cwd(), ".env") })
config({ path: path.resolve(process.cwd(), "..", ".env"), override: false })

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(24),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  STORAGE_DIR: z.string().default(path.resolve(process.cwd(), "storage")),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-5-mini"),
  OPENAI_STT_MODEL: z.string().default("gpt-4o-mini-transcribe"),
  DIARIZATION_SPEAKERS: z.string().default("Doctor,Patient"),
  AUDIT_RETENTION_DAYS: z.coerce.number().int().positive().default(2555),
  BILLING_SCHEDULES_PATH: z.string().optional(),
  ALLOW_DEV_LOGIN: z.coerce.boolean().optional(),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().optional(),
  REFRESH_TOKEN_TTL_HOURS: z.coerce.number().int().positive().optional(),
  DISPATCH_TARGET: z.enum(["NONE", "FHIR_R4", "HL7_V2", "VENDOR_API"]).default("NONE"),
  DISPATCH_WEBHOOK_URL: z.string().optional(),
  DISPATCH_VENDOR: z.enum(["GENERIC", "ATHENAHEALTH", "NEXTGEN", "ECLINICALWORKS"]).default("GENERIC"),
  DISPATCH_MLLP_HOST: z.string().optional(),
  DISPATCH_MLLP_PORT: z.coerce.number().int().positive().optional(),
  DISPATCH_AUTH_MODE: z.enum(["NONE", "API_KEY", "BEARER", "HMAC"]).default("NONE"),
  DISPATCH_API_KEY_HEADER: z.string().default("x-api-key"),
  DISPATCH_API_KEY: z.string().optional(),
  DISPATCH_BEARER_TOKEN: z.string().optional(),
  DISPATCH_HMAC_HEADER: z.string().default("x-rp-signature"),
  DISPATCH_HMAC_SECRET: z.string().optional(),
  DISPATCH_CLIENT_CERT_PATH: z.string().optional(),
  DISPATCH_CLIENT_KEY_PATH: z.string().optional(),
  DISPATCH_CLIENT_CA_PATH: z.string().optional(),
  DISPATCH_DEAD_LETTER_ALERT_THRESHOLD: z.coerce.number().int().nonnegative().default(5),
  DISPATCH_DEAD_LETTER_ALERT_WINDOW_MINUTES: z.coerce.number().int().positive().default(60),
  DISPATCH_DEAD_LETTER_ALERT_COOLDOWN_MINUTES: z.coerce.number().int().positive().default(30),
  ALERT_WEBHOOK_URL: z.string().optional(),
  ALERT_SLACK_WEBHOOK_URL: z.string().optional(),
  PAGERDUTY_ROUTING_KEY: z.string().optional(),
  DISPATCH_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  DISPATCH_BACKOFF_MS: z.coerce.number().int().positive().default(15000),
  PASSWORD_MIN_LENGTH: z.coerce.number().int().min(12).default(12),
  MFA_REQUIRED: z.coerce.boolean().optional(),
  MFA_ISSUER: z.string().default("RevenuePilot"),
  AUTH_LOGIN_WINDOW_SECONDS: z.coerce.number().int().positive().default(300),
  AUTH_LOGIN_MAX_ATTEMPTS: z.coerce.number().int().positive().default(8),
  AUTH_LOGIN_BLOCK_SECONDS: z.coerce.number().int().positive().default(900),
  AUTH_REFRESH_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
  AUTH_REFRESH_MAX_ATTEMPTS: z.coerce.number().int().positive().default(20),
  AUTH_REFRESH_BLOCK_SECONDS: z.coerce.number().int().positive().default(300),
  SECRET_ROTATION_MAX_AGE_DAYS: z.coerce.number().int().positive().default(90),
  AI_SUGGESTION_ACCEPTANCE_ALERT_THRESHOLD: z.coerce.number().min(0).max(1).default(0.3),
  AI_SUGGESTION_ACCEPTANCE_ALERT_MIN_DECISIONS: z.coerce.number().int().positive().default(20),
  AI_TRANSCRIPT_CORRECTION_ALERT_THRESHOLD: z.coerce.number().min(0).max(1).default(0.22),
  AI_TRANSCRIPT_CORRECTION_ALERT_MIN_SEGMENTS: z.coerce.number().int().positive().default(40),
  AI_COMPLIANCE_FALSE_POSITIVE_ALERT_THRESHOLD: z.coerce.number().min(0).max(1).default(0.5),
  AI_COMPLIANCE_FALSE_POSITIVE_ALERT_MIN_REVIEWED: z.coerce.number().int().positive().default(15)
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error("Invalid environment variables", parsed.error.flatten().fieldErrors)
  throw new Error("Environment validation failed")
}

const parsedEnv = parsed.data

const normalizedEnv = {
  ...parsedEnv,
  ALLOW_DEV_LOGIN: parsedEnv.ALLOW_DEV_LOGIN ?? (parsedEnv.NODE_ENV === "production" ? false : true),
  SESSION_TTL_HOURS: parsedEnv.SESSION_TTL_HOURS ?? (parsedEnv.NODE_ENV === "production" ? 12 : 720),
  REFRESH_TOKEN_TTL_HOURS: parsedEnv.REFRESH_TOKEN_TTL_HOURS ?? (parsedEnv.NODE_ENV === "production" ? 168 : 720),
  MFA_REQUIRED: parsedEnv.MFA_REQUIRED ?? (parsedEnv.NODE_ENV === "production" ? true : false)
}

if (normalizedEnv.NODE_ENV === "production") {
  const productionConfigErrors: string[] = []

  if (normalizedEnv.ALLOW_DEV_LOGIN) {
    productionConfigErrors.push("ALLOW_DEV_LOGIN must be false in production.")
  }
  if (normalizedEnv.SESSION_TTL_HOURS > 24) {
    productionConfigErrors.push("SESSION_TTL_HOURS must be <= 24 in production.")
  }
  if (normalizedEnv.REFRESH_TOKEN_TTL_HOURS > 24 * 30) {
    productionConfigErrors.push("REFRESH_TOKEN_TTL_HOURS must be <= 720 (30 days) in production.")
  }
  if (!normalizedEnv.MFA_REQUIRED) {
    productionConfigErrors.push("MFA_REQUIRED must be true in production.")
  }

  if (productionConfigErrors.length > 0) {
    console.error("Invalid production security configuration", productionConfigErrors)
    throw new Error("Production security configuration validation failed")
  }
}

export const env = normalizedEnv
