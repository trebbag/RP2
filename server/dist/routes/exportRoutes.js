import fs from "node:fs";
import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../middleware/errorHandler.js";
import { requireRole } from "../middleware/auth.js";
export const exportRoutes = Router();
exportRoutes.use(requireRole(["ADMIN", "MA", "CLINICIAN"]));
exportRoutes.get("/:artifactId", async (req, res, next) => {
    try {
        const authReq = req;
        const artifact = await prisma.exportArtifact.findFirst({
            where: { id: req.params.artifactId, orgId: authReq.user.orgId }
        });
        if (!artifact) {
            throw new ApiError(404, "Export artifact not found");
        }
        if (!fs.existsSync(artifact.filePath)) {
            throw new ApiError(410, "Artifact file no longer exists");
        }
        res.setHeader("Content-Type", artifact.mimeType);
        res.setHeader("Content-Disposition", `attachment; filename=\"${artifact.fileName}\"`);
        fs.createReadStream(artifact.filePath).pipe(res);
    }
    catch (error) {
        next(error);
    }
});
//# sourceMappingURL=exportRoutes.js.map