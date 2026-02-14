import assert from "node:assert/strict"
import test from "node:test"
import supertest from "supertest"
import { PrismaClient } from "@prisma/client"
import { clearTablesInOrder, createAdminPrisma, resolveIntegrationAdminDbUrl } from "./helpers/adminDb.js"

const shouldRunIntegration = process.env.RP2_RUN_INTEGRATION === "1"
const integrationDbUrl = process.env.RP2_INTEGRATION_DB_URL || process.env.DATABASE_URL
const integrationAdminDbUrl = resolveIntegrationAdminDbUrl()

if (!shouldRunIntegration || !integrationDbUrl || !integrationAdminDbUrl) {
  test("rls tenant isolation integration (skipped)", { skip: true }, () => {
    assert.ok(true)
  })
} else {
  test("rls enforces org isolation even without app-layer where clauses", async () => {
    process.env.DATABASE_URL = integrationDbUrl
    process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-jwt-secret-1234567890"
    process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173"
    process.env.STORAGE_DIR = process.env.STORAGE_DIR || "./storage"
    process.env.RP2_OFFLINE_AI = process.env.RP2_OFFLINE_AI || "1"

    const { createApp } = await import("../src/app.js")

    const adminPrisma = createAdminPrisma()
    const appPrisma = new PrismaClient({
      datasources: {
        db: { url: integrationDbUrl }
      }
    })

    const app = createApp()
    const request = supertest(app)

    await adminPrisma.$connect()
    await appPrisma.$connect()
    await clearTablesInOrder(adminPrisma)

    const login = async (input: {
      email: string
      name: string
      role: "ADMIN" | "MA" | "CLINICIAN"
      orgSlug: string
      orgName: string
    }) => {
      const response = await request.post("/api/auth/dev-login").send(input)
      assert.equal(response.status, 200)
      return {
        headers: { Authorization: `Bearer ${response.body.token}` },
        orgId: response.body.user.orgId as string
      }
    }

    const orgA = await login({
      email: "rls.tenant.a@revenuepilot.local",
      name: "RLS Tenant A",
      role: "CLINICIAN",
      orgSlug: "rls-tenant-a",
      orgName: "RLS Tenant A"
    })

    const orgB = await login({
      email: "rls.tenant.b@revenuepilot.local",
      name: "RLS Tenant B",
      role: "CLINICIAN",
      orgSlug: "rls-tenant-b",
      orgName: "RLS Tenant B"
    })

    const createAppointment = async (org: { headers: Record<string, string> }, patientName: string) => {
      const response = await request
        .post("/api/appointments")
        .set(org.headers)
        .send({
          patientName,
          patientPhone: "(555) 900-0000",
          patientEmail: "rls.patient@example.com",
          appointmentTime: new Date(Date.now() + 120_000).toISOString(),
          duration: 30,
          appointmentType: "Follow-up",
          provider: "Dr. RLS",
          location: "Room RLS",
          notes: "rls isolation test",
          priority: "medium",
          isVirtual: false
        })
      assert.equal(response.status, 201)
      return response.body.appointment.encounterId as string
    }

    await createAppointment(orgA, "RLS Patient A")
    await createAppointment(orgB, "RLS Patient B")

    // With no current_org setting, RLS should return empty sets by default.
    const countWithoutSetting = await appPrisma.patient.count()
    assert.equal(countWithoutSetting, 0)

    const distinctOrgIdsA = await appPrisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_org', ${orgA.orgId}, true)`
      return tx.$queryRaw<Array<{ orgId: string }>>`SELECT DISTINCT "orgId" FROM "Patient" ORDER BY "orgId"`
    })
    assert.deepEqual(
      distinctOrgIdsA.map((row) => row.orgId),
      [orgA.orgId]
    )

    const distinctOrgIdsB = await appPrisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_org', ${orgB.orgId}, true)`
      return tx.$queryRaw<Array<{ orgId: string }>>`SELECT DISTINCT "orgId" FROM "Patient" ORDER BY "orgId"`
    })
    assert.deepEqual(
      distinctOrgIdsB.map((row) => row.orgId),
      [orgB.orgId]
    )

    await assert.rejects(async () => {
      await appPrisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.current_org', ${orgA.orgId}, true)`
        await tx.$executeRaw`
            INSERT INTO "Patient" ("id", "orgId", "externalId", "firstName", "lastName", "createdAt", "updatedAt")
            VALUES (${`p_rls_${Date.now()}`}, ${orgB.orgId}, ${`EXT-${Date.now()}`}, ${"Evil"}, ${"CrossTenant"}, ${new Date()}, ${new Date()})
          `
      })
    }, /row-level security|violates.*row.*security|RLS/i)

    await clearTablesInOrder(adminPrisma)
    await appPrisma.$disconnect()
    await adminPrisma.$disconnect()
  })
}
