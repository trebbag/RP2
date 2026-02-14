import { prismaBase } from "./prisma.js"
import { getDbClient, runWithDbClient } from "./dbSession.js"

export async function runWithRls<T>(orgId: string, fn: () => Promise<T>): Promise<T> {
  const existing = getDbClient()
  if (existing) {
    return fn()
  }

  return prismaBase.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_org', ${orgId}, true)`
    return runWithDbClient(tx, fn)
  })
}

export async function setRlsOrgId(orgId: string): Promise<void> {
  const existing = getDbClient<any>()
  if (!existing) {
    throw new Error("setRlsOrgId must be called inside a DB session/transaction")
  }

  await existing.$executeRaw`SELECT set_config('app.current_org', ${orgId}, true)`
}
