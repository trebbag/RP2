import { AsyncLocalStorage } from "node:async_hooks"

type DbSessionStore = {
  client: unknown
}

const storage = new AsyncLocalStorage<DbSessionStore>()

export function runWithDbClient<T>(client: unknown, fn: () => T): T {
  return storage.run({ client }, fn)
}

export function getDbClient<T = unknown>(): T | null {
  return (storage.getStore()?.client as T | undefined) ?? null
}
