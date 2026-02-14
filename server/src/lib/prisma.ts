import { PrismaClient } from "@prisma/client"
import { getTenantOrgId } from "./tenantContext.js"
import { getDbClient } from "./dbSession.js"

const TENANT_SCOPED_MODELS = new Set<string>([
  "Patient",
  "Appointment",
  "Encounter",
  "Note",
  "NoteVersion",
  "TranscriptSegment",
  "ChartAsset",
  "ChartExtractionJob",
  "SuggestionGeneration",
  "CodeSuggestion",
  "CodeSelection",
  "ComplianceIssue",
  "WizardRun",
  "WizardStepState",
  "ExportArtifact",
  "AuditLog",
  "DispatchJob"
])

const basePrisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"]
})

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null
  return value as Record<string, unknown>
}

function isTenantScopedModel(model: string): boolean {
  if (TENANT_SCOPED_MODELS.has(model)) return true
  const upper = model.charAt(0).toUpperCase() + model.slice(1)
  return TENANT_SCOPED_MODELS.has(upper)
}

function ensureOrgInWhere(args: Record<string, unknown>, orgId: string) {
  const where = asRecord(args.where) ?? {}
  const existingOrg = where.orgId
  if (typeof existingOrg === "string" && existingOrg && existingOrg !== orgId) {
    throw new Error("Tenant scope mismatch (where.orgId)")
  }
  where.orgId = orgId
  args.where = where
}

function ensureOrgInData(args: Record<string, unknown>, orgId: string) {
  const data = asRecord(args.data)
  if (!data) return
  const existingOrg = data.orgId
  if (typeof existingOrg === "string" && existingOrg && existingOrg !== orgId) {
    throw new Error("Tenant scope mismatch (data.orgId)")
  }
  data.orgId = orgId
  args.data = data
}

function ensureOrgInCreateMany(args: Record<string, unknown>, orgId: string) {
  const data = args.data
  if (Array.isArray(data)) {
    for (const item of data) {
      const record = asRecord(item)
      if (!record) continue
      const existingOrg = record.orgId
      if (typeof existingOrg === "string" && existingOrg && existingOrg !== orgId) {
        throw new Error("Tenant scope mismatch (createMany.data[].orgId)")
      }
      record.orgId = orgId
    }
    args.data = data
    return
  }

  const record = asRecord(data)
  if (!record) return
  const existingOrg = record.orgId
  if (typeof existingOrg === "string" && existingOrg && existingOrg !== orgId) {
    throw new Error("Tenant scope mismatch (createMany.data.orgId)")
  }
  record.orgId = orgId
  args.data = record
}

const prismaWithTenantGuardrails = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const orgId = getTenantOrgId()
        if (!orgId || !isTenantScopedModel(model)) {
          return query(args)
        }

        const nextArgs = asRecord(args) ?? {}

        switch (operation) {
          case "findMany":
          case "findFirst":
          case "findFirstOrThrow":
          case "count":
          case "aggregate":
          case "groupBy":
          case "updateMany":
          case "deleteMany":
            ensureOrgInWhere(nextArgs, orgId)
            break
          case "create":
            ensureOrgInData(nextArgs, orgId)
            break
          case "createMany":
            ensureOrgInCreateMany(nextArgs, orgId)
            break
          default:
            break
        }

        return query(nextArgs)
      }
    }
  }
})

export const prismaBase = prismaWithTenantGuardrails

export const prisma = new Proxy(prismaWithTenantGuardrails, {
  get(target, prop, receiver) {
    // Always route lifecycle helpers to the root client.
    if (
      prop === "$connect" ||
      prop === "$disconnect" ||
      prop === "$on" ||
      prop === "$transaction" ||
      prop === "$use" ||
      prop === "$extends"
    ) {
      const value = Reflect.get(target, prop, receiver) as unknown
      return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(target) : value
    }

    const sessionClient = getDbClient<any>()
    const client = sessionClient ?? target
    const value = Reflect.get(client, prop, receiver) as unknown
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(client) : value
  }
}) as typeof prismaWithTenantGuardrails
