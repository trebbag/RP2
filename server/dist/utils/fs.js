import fs from "node:fs/promises";
import path from "node:path";
export async function ensureDir(dirPath) {
    await fs.mkdir(dirPath, { recursive: true });
}
export async function writeJsonFile(filePath, payload) {
    await ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
}
//# sourceMappingURL=fs.js.map