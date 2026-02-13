import fs from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";
import { writeJsonFile } from "../utils/fs.js";
export async function persistTraceJson(input) {
    const filePath = path.resolve(env.STORAGE_DIR, "output", input.runId, input.fileName);
    await writeJsonFile(filePath, input.payload);
    const stats = await fs.stat(filePath);
    return {
        filePath,
        fileName: input.fileName,
        sizeBytes: Number(stats.size)
    };
}
//# sourceMappingURL=traceService.js.map