import { getDbClient, runWithDbClient } from "./dbSession.js"
import { prismaBase } from "./prisma.js"

export async function transactional<T>(fn: (tx: any) => Promise<T>): Promise<T> {
  const existing = getDbClient<any>()
  if (existing) {
    return fn(existing)
  }

  return prismaBase.$transaction(async (tx) => {
    return runWithDbClient(tx, () => fn(tx))
  })
}
