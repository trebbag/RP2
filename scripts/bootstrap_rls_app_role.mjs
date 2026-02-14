#!/usr/bin/env node

import { PrismaClient } from "@prisma/client"

const adminUrl = process.env.DATABASE_ADMIN_URL || process.env.DATABASE_URL
if (!adminUrl) {
  console.error("Missing DATABASE_ADMIN_URL (or DATABASE_URL).")
  process.exit(1)
}

const role = process.env.RP2_APP_DB_USER || "rp2_app"
const password = process.env.RP2_APP_DB_PASSWORD || "rp2_app"

if (!/^[a-z_][a-z0-9_]*$/.test(role)) {
  console.error(`Invalid RP2_APP_DB_USER: ${role}`)
  process.exit(1)
}

if (password.includes("'")) {
  console.error("RP2_APP_DB_PASSWORD must not contain single quotes for bootstrap script safety.")
  process.exit(1)
}

const prisma = new PrismaClient({
  datasources: {
    db: { url: adminUrl }
  }
})

async function main() {
  await prisma.$connect()

  // Create or update the app role. This role must not be superuser and must not bypass RLS.
  await prisma.$executeRawUnsafe(`
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${role}') THEN
    CREATE ROLE ${role} LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
  ELSE
    ALTER ROLE ${role} LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
  END IF;
END$$;
`)

  await prisma.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO ${role};`)
  await prisma.$executeRawUnsafe(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${role};`)
  await prisma.$executeRawUnsafe(
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${role};`
  )

  await prisma.$executeRawUnsafe(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${role};`)
  await prisma.$executeRawUnsafe(
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${role};`
  )

  console.log(JSON.stringify({ ok: true, role }, null, 2))
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
