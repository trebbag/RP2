export interface PasswordValidationResult {
    valid: boolean;
    issues: string[];
}
export declare function validatePasswordComplexity(password: string): PasswordValidationResult;
export declare function verifyTotpCode(secret: string, token: string, window?: number): boolean;
export declare function generateMfaSecret(): string;
export declare function buildOtpAuthUrl(input: {
    email: string;
    secret: string;
}): string;
export declare function generateBackupCodes(count?: number): {
    plain: string[];
    hashed: string[];
};
export declare function consumeBackupCode(code: string, hashedCodes: string[]): {
    valid: boolean;
    remainingHashed: string[];
};
