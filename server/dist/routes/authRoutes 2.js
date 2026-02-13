import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authenticate, signAuthToken } from "../middleware/auth.js";
import { ApiError } from "../middleware/errorHandler.js";
export const authRoutes = Router();
const devLoginSchema = z.object({
    email: z.string().email(),
    name: z.string().min(2),
    role: z.enum(["ADMIN", "MA", "CLINICIAN"]).default("CLINICIAN")
});
authRoutes.post("/dev-login", async (req, res, next) => {
    try {
        if (process.env.NODE_ENV === "production") {
            throw new ApiError(404, "Dev login is disabled in production");
        }
        const payload = devLoginSchema.parse(req.body);
        const user = await prisma.user.upsert({
            where: { email: payload.email },
            update: {
                name: payload.name,
                role: payload.role
            },
            create: {
                email: payload.email,
                name: payload.name,
                role: payload.role
            }
        });
        const token = signAuthToken({
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role
        });
        res.status(200).json({ token, user });
    }
    catch (error) {
        next(error);
    }
});
authRoutes.get("/me", authenticate, async (req, res, next) => {
    try {
        const authReq = req;
        const user = await prisma.user.findUnique({ where: { id: authReq.user.id } });
        if (!user) {
            res.status(200).json({ user: authReq.user, source: "token" });
            return;
        }
        res.status(200).json({ user, source: "database" });
    }
    catch (error) {
        next(error);
    }
});
//# sourceMappingURL=authRoutes%202.js.map