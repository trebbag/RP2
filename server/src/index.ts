import { createApp } from "./app.js"
import { env } from "./config/env.js"
import { logger } from "./lib/logger.js"
import { prisma } from "./lib/prisma.js"
import { emitDeadLetterAlertIfNeeded, processDueDispatchJobs } from "./services/dispatchService.js"

const app = createApp()
let dispatchWorkerTimer: NodeJS.Timeout | null = null

const server = app.listen(env.PORT, async () => {
  try {
    await prisma.$connect()
    logger.info(`RevenuePilot server listening on port ${env.PORT}`)

    dispatchWorkerTimer = setInterval(async () => {
      try {
        const processed = await processDueDispatchJobs(10)
        if (processed.length > 0) {
          logger.info("dispatch.worker.processed", {
            count: processed.length,
            ids: processed.map((job) => job.id)
          })
        }

        await emitDeadLetterAlertIfNeeded()
      } catch (error) {
        logger.error("dispatch.worker.error", error)
      }
    }, 15_000)
  } catch (error) {
    logger.error("Failed to connect to database", error)
  }
})

const shutdown = async () => {
  logger.info("Shutting down server")
  if (dispatchWorkerTimer) {
    clearInterval(dispatchWorkerTimer)
    dispatchWorkerTimer = null
  }
  await prisma.$disconnect()
  server.close(() => {
    process.exit(0)
  })
}

process.on("SIGTERM", shutdown)
process.on("SIGINT", shutdown)
