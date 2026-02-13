import fs from "node:fs/promises"
import path from "node:path"

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true })
}

export async function writeJsonFile<T>(filePath: string, payload: T): Promise<void> {
  await ensureDir(path.dirname(filePath))
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf8")
}
