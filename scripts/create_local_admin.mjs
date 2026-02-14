#!/usr/bin/env node

import { randomBytes, scryptSync } from "node:crypto"
import { config as loadEnv } from "dotenv"
import { PrismaClient } from "@prisma/client"

loadEnv({ path: ".env" })

const args = process.argv.slice(2)

function argValue(flag, fallback) {
  const index = args.indexOf(flag)
  if (index === -1) return fallback
  const value = args[index + 1]
  if (!value || value.startsWith("--")) return fallback
  return value
}

const email = argValue("--email", process.env.RP2_ADMIN_EMAIL || "admin@rp2.local")
const name = argValue("--name", process.env.RP2_ADMIN_NAME || "RP2 Admin")
const password = argValue("--password", process.env.RP2_ADMIN_PASSWORD || "AdminPass#12345")

if (!process.env.DATABASE_URL) {
  console.error("Missing DATABASE_URL. Set it in .env or current shell.")
  process.exit(1)
}

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to run in production mode.")
  process.exit(1)
}

const prisma = new PrismaClient()
const SYSTEM_ORG_ID = "org_system"
const DEFAULT_ORG_ID = "org_default"

async function ensureTenantBootstrap() {
  await prisma.organization.upsert({
    where: { id: SYSTEM_ORG_ID },
    update: { name: "System", slug: "system" },
    create: { id: SYSTEM_ORG_ID, name: "System", slug: "system" }
  })

  await prisma.organization.upsert({
    where: { id: DEFAULT_ORG_ID },
    update: { name: "Default Organization", slug: "default" },
    create: { id: DEFAULT_ORG_ID, name: "Default Organization", slug: "default" }
  })
}

function hashPassword(rawPassword) {
  const salt = randomBytes(16).toString("hex")
  const key = scryptSync(rawPassword, salt, 64)
  return `scrypt$${salt}$${key.toString("hex")}`
}

async function main() {
  await ensureTenantBootstrap()
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name,
      role: "ADMIN",
      passwordHash: hashPassword(password),
      mfaEnabled: false,
      mfaSecret: null,
      mfaBackupCodesHash: [],
      mfaEnrolledAt: null
    },
    create: {
      email,
      name,
      role: "ADMIN",
      passwordHash: hashPassword(password)
    }
  })

  await prisma.membership.upsert({
    where: {
      orgId_userId: {
        orgId: DEFAULT_ORG_ID,
        userId: user.id
      }
    },
    update: {
      role: "ADMIN"
    },
    create: {
      orgId: DEFAULT_ORG_ID,
      userId: user.id,
      role: "ADMIN"
    }
  })

  console.log(
    JSON.stringify(
      {
        ok: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: "ADMIN",
          orgId: DEFAULT_ORG_ID
        },
        login: {
          email,
          password
        }
      },
      null,
      2
    )
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
