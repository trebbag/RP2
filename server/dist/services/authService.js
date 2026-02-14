import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { prisma } from "../lib/prisma.js";
export function hashPassword(password) {
    const salt = randomBytes(16).toString("hex");
    const key = scryptSync(password, salt, 64);
    return `scrypt$${salt}$${key.toString("hex")}`;
}
export function verifyPassword(password, hashedPassword) {
    const parts = hashedPassword.split("$");
    if (parts.length !== 3 || parts[0] !== "scrypt")
        return false;
    const salt = parts[1];
    const expectedHex = parts[2];
    if (!salt || !expectedHex)
        return false;
    const derived = scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHex, "hex");
    if (expected.length !== derived.length)
        return false;
    return timingSafeEqual(derived, expected);
}
function hashRefreshToken(token) {
    const secret = process.env.JWT_SECRET ?? "development-refresh-secret-not-for-prod";
    return createHash("sha256")
        .update(token)
        .update("|")
        .update(secret)
        .digest("hex");
}
function createRawRefreshToken() {
    return randomBytes(48).toString("base64url");
}
function resolveRefreshSessionExpiry() {
    const ttlHours = Math.max(1, Number.parseInt(process.env.REFRESH_TOKEN_TTL_HOURS ?? "168", 10));
    return new Date(Date.now() + ttlHours * 60 * 60 * 1000);
}
export async function createRefreshSession(userId, orgId, meta) {
    const token = createRawRefreshToken();
    const refreshTokenHash = hashRefreshToken(token);
    const expiresAt = resolveRefreshSessionExpiry();
    const session = await prisma.authSession.create({
        data: {
            orgId,
            userId,
            refreshTokenHash,
            expiresAt,
            ip: meta?.ip,
            userAgent: meta?.userAgent
        }
    });
    return {
        token,
        session
    };
}
export async function rotateRefreshSession(refreshToken, meta) {
    const refreshTokenHash = hashRefreshToken(refreshToken);
    const existing = await prisma.authSession.findUnique({
        where: { refreshTokenHash },
        include: { user: true }
    });
    if (!existing || existing.revokedAt || existing.expiresAt.getTime() < Date.now()) {
        return null;
    }
    const replacementToken = createRawRefreshToken();
    const replacementHash = hashRefreshToken(replacementToken);
    const nextExpiresAt = resolveRefreshSessionExpiry();
    const nextSession = await prisma.$transaction(async (tx) => {
        await tx.authSession.update({
            where: { id: existing.id },
            data: { revokedAt: new Date() }
        });
        return tx.authSession.create({
            data: {
                orgId: existing.orgId,
                userId: existing.userId,
                refreshTokenHash: replacementHash,
                expiresAt: nextExpiresAt,
                ip: meta?.ip,
                userAgent: meta?.userAgent
            }
        });
    });
    return {
        user: existing.user,
        orgId: existing.orgId,
        token: replacementToken,
        session: nextSession
    };
}
export async function revokeRefreshSession(refreshToken) {
    const refreshTokenHash = hashRefreshToken(refreshToken);
    await prisma.authSession.updateMany({
        where: {
            refreshTokenHash,
            revokedAt: null
        },
        data: {
            revokedAt: new Date()
        }
    });
}
export async function revokeAllUserSessions(userId) {
    await prisma.authSession.updateMany({
        where: {
            userId,
            revokedAt: null
        },
        data: {
            revokedAt: new Date()
        }
    });
}
//# sourceMappingURL=authService.js.map