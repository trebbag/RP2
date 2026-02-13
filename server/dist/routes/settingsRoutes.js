import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { normalizeUserSettingsPayload, userSettingsSchema } from "../services/settingsService.js";
import { ApiError } from "../middleware/errorHandler.js";
import { writeAuditLog } from "../middleware/audit.js";
const updateSettingsSchema = z.object({
    settings: userSettingsSchema
});
export const settingsRoutes = Router();
settingsRoutes.get("/me", async (req, res, next) => {
    try {
        const authReq = req;
        const record = await prisma.userSettings.findUnique({
            where: { userId: authReq.user.id }
        });
        const settings = normalizeUserSettingsPayload(record?.payload);
        res.status(200).json({
            settings,
            updatedAt: record?.updatedAt ?? null
        });
    }
    catch (error) {
        next(error);
    }
});
settingsRoutes.put("/me", async (req, res, next) => {
    try {
        const authReq = req;
        const payload = updateSettingsSchema.parse(req.body ?? {});
        const userExists = await prisma.user.findUnique({ where: { id: authReq.user.id } });
        if (!userExists) {
            throw new ApiError(404, "User not found");
        }
        const settings = normalizeUserSettingsPayload(payload.settings);
        const updated = await prisma.userSettings.upsert({
            where: { userId: authReq.user.id },
            create: {
                userId: authReq.user.id,
                payload: settings,
                updatedById: authReq.user.id
            },
            update: {
                payload: settings,
                updatedById: authReq.user.id
            }
        });
        await writeAuditLog({
            req,
            res,
            action: "settings_update",
            entity: "user_settings",
            entityId: updated.id,
            details: {
                userId: authReq.user.id
            }
        });
        res.status(200).json({
            settings,
            updatedAt: updated.updatedAt
        });
    }
    catch (error) {
        next(error);
    }
});
//# sourceMappingURL=settingsRoutes.js.map