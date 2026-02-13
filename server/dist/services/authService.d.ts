interface RequestMeta {
    ip?: string;
    userAgent?: string;
}
export declare function hashPassword(password: string): string;
export declare function verifyPassword(password: string, hashedPassword: string): boolean;
export declare function createRefreshSession(userId: string, meta?: RequestMeta): Promise<{
    token: string;
    session: {
        id: string;
        ip: string | null;
        userAgent: string | null;
        createdAt: Date;
        refreshTokenHash: string;
        expiresAt: Date;
        revokedAt: Date | null;
        updatedAt: Date;
        userId: string;
    };
}>;
export declare function rotateRefreshSession(refreshToken: string, meta?: RequestMeta): Promise<{
    user: {
        email: string;
        name: string;
        role: import("@prisma/client").$Enums.UserRole;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        passwordHash: string | null;
        mfaEnabled: boolean;
        mfaSecret: string | null;
        mfaBackupCodesHash: import("@prisma/client/runtime/library").JsonValue | null;
        mfaEnrolledAt: Date | null;
    };
    token: string;
    session: {
        id: string;
        ip: string | null;
        userAgent: string | null;
        createdAt: Date;
        refreshTokenHash: string;
        expiresAt: Date;
        revokedAt: Date | null;
        updatedAt: Date;
        userId: string;
    };
}>;
export declare function revokeRefreshSession(refreshToken: string): Promise<void>;
export declare function revokeAllUserSessions(userId: string): Promise<void>;
export {};
