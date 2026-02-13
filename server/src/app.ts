import express from "express"
import cors from "cors"
import helmet from "helmet"
import morgan from "morgan"
import { env } from "./config/env.js"
import { authenticate } from "./middleware/auth.js"
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js"
import { requestContext } from "./middleware/requestContext.js"
import { authRoutes } from "./routes/authRoutes.js"
import { appointmentRoutes } from "./routes/appointmentRoutes.js"
import { encounterRoutes } from "./routes/encounterRoutes.js"
import { draftRoutes } from "./routes/draftRoutes.js"
import { wizardRoutes } from "./routes/wizardRoutes.js"
import { exportRoutes } from "./routes/exportRoutes.js"
import { adminRoutes } from "./routes/adminRoutes.js"
import { settingsRoutes } from "./routes/settingsRoutes.js"
import { activityRoutes } from "./routes/activityRoutes.js"
import { authLoginRateLimiter, authRefreshRateLimiter } from "./middleware/rateLimit.js"

export function createApp() {
  const app = express()

  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true
    })
  )

  app.use(
    helmet({
      crossOriginResourcePolicy: false
    })
  )

  app.use(requestContext)
  app.use(
    morgan((tokens, req, res) => {
      const rawUrl = tokens.url(req, res) ?? ""
      const withoutQuery = rawUrl.split("?")[0] ?? rawUrl
      const safeUrl = withoutQuery.replace(/access_token=[^&]+/g, "access_token=[redacted]")
      return `${tokens.method(req, res)} ${safeUrl} ${tokens.status(req, res)} ${tokens["response-time"](req, res)} ms request_id=${tokens.res(req, res, "x-request-id")}`
    })
  )
  app.use(express.json({ limit: "2mb" }))
  app.use(express.urlencoded({ extended: true }))

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok", at: new Date().toISOString() })
  })

  app.use("/api/auth/login", authLoginRateLimiter)
  app.use("/api/auth/mfa/enroll/start", authLoginRateLimiter)
  app.use("/api/auth/refresh", authRefreshRateLimiter)
  app.use("/api/auth", authRoutes)
  app.use("/api/appointments", authenticate, appointmentRoutes)
  app.use("/api/encounters", authenticate, encounterRoutes)
  app.use("/api/wizard", authenticate, wizardRoutes)
  app.use("/api/drafts", authenticate, draftRoutes)
  app.use("/api/exports", authenticate, exportRoutes)
  app.use("/api/admin", authenticate, adminRoutes)
  app.use("/api/settings", authenticate, settingsRoutes)
  app.use("/api/activity", authenticate, activityRoutes)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
