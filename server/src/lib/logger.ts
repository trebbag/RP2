/* eslint-disable no-console */

type LogLevel = "INFO" | "WARN" | "ERROR"

function write(level: LogLevel, message: string, meta?: unknown) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    message,
    ...(meta && typeof meta === "object" ? { meta } : { meta: meta ?? null })
  }
  console.log(JSON.stringify(payload))
}

export const logger = {
  info: (message: string, meta?: unknown) => {
    write("INFO", message, meta)
  },
  warn: (message: string, meta?: unknown) => {
    write("WARN", message, meta)
  },
  error: (message: string, meta?: unknown) => {
    write("ERROR", message, meta)
  }
}
