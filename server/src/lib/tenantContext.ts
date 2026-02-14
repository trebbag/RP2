import { AsyncLocalStorage } from "node:async_hooks"

type TenantStore = {
  orgId: string
}

const storage = new AsyncLocalStorage<TenantStore>()

export function runWithTenantOrg<T>(orgId: string, fn: () => T): T {
  return storage.run({ orgId }, fn)
}

export function getTenantOrgId(): string | null {
  return storage.getStore()?.orgId ?? null
}
