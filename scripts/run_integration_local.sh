#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

POSTGRES_PORT="${RP2_POSTGRES_PORT:-5432}"
export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:${POSTGRES_PORT}/revenuepilot}"
export JWT_SECRET="${JWT_SECRET:-integration-jwt-secret-1234567890}"
export CORS_ORIGIN="${CORS_ORIGIN:-http://localhost:5173}"
export STORAGE_DIR="${STORAGE_DIR:-./server/storage}"
export ALLOW_DEV_LOGIN="${ALLOW_DEV_LOGIN:-true}"

echo "[integration-local] Starting PostgreSQL (docker compose)"
npm run db:up

echo "[integration-local] Waiting for PostgreSQL to accept connections"
node <<'NODE'
const net = require("node:net")
const { URL } = require("node:url")

const url = new URL(process.env.DATABASE_URL)
const host = url.hostname || "localhost"
const port = Number(url.port || 5432)
const maxAttempts = 30

let attempt = 0
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function probe() {
  while (attempt < maxAttempts) {
    attempt += 1
    const ok = await new Promise((resolve) => {
      const socket = new net.Socket()
      socket.setTimeout(2000)
      socket.once("connect", () => {
        socket.destroy()
        resolve(true)
      })
      socket.once("error", () => {
        socket.destroy()
        resolve(false)
      })
      socket.once("timeout", () => {
        socket.destroy()
        resolve(false)
      })
      socket.connect(port, host)
    })

    if (ok) {
      console.log(`[integration-local] Postgres is ready on ${host}:${port}`)
      return
    }

    await wait(1000)
  }

  throw new Error(`Postgres did not become ready after ${maxAttempts} attempts (${host}:${port})`)
}

probe().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
NODE

echo "[integration-local] Preparing Prisma schema"
npm run test:integration:prepare

echo "[integration-local] Running integration tests"
npm run test:integration

echo "[integration-local] Running soak tests"
npm run test:soak
