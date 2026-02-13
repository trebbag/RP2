import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function validatePasswordComplexity(password) {
    const issues = [];
    const minLength = env.PASSWORD_MIN_LENGTH;
    if (password.length < minLength) {
        issues.push(`Password must be at least ${minLength} characters.`);
    }
    if (!/[a-z]/.test(password)) {
        issues.push("Password must include at least one lowercase letter.");
    }
    if (!/[A-Z]/.test(password)) {
        issues.push("Password must include at least one uppercase letter.");
    }
    if (!/\d/.test(password)) {
        issues.push("Password must include at least one number.");
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
        issues.push("Password must include at least one symbol.");
    }
    if (/\s/.test(password)) {
        issues.push("Password must not contain whitespace.");
    }
    const lowered = password.toLowerCase();
    const weakPatterns = ["password", "qwerty", "letmein", "admin", "welcome", "123456"];
    if (weakPatterns.some((pattern) => lowered.includes(pattern))) {
        issues.push("Password includes a common weak pattern.");
    }
    return {
        valid: issues.length === 0,
        issues
    };
}
function toBase32(buffer) {
    let bits = 0;
    let value = 0;
    let output = "";
    for (const byte of buffer) {
        value = (value << 8) | byte;
        bits += 8;
        while (bits >= 5) {
            output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }
    if (bits > 0) {
        output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
    }
    return output;
}
function fromBase32(value) {
    const normalized = value.toUpperCase().replace(/=+$/g, "").replace(/[^A-Z2-7]/g, "");
    let bits = 0;
    let buffer = 0;
    const bytes = [];
    for (const char of normalized) {
        const index = BASE32_ALPHABET.indexOf(char);
        if (index === -1)
            continue;
        buffer = (buffer << 5) | index;
        bits += 5;
        if (bits >= 8) {
            bytes.push((buffer >>> (bits - 8)) & 0xff);
            bits -= 8;
        }
    }
    return Buffer.from(bytes);
}
function generateTotp(secret, timeMs, stepSeconds = 30, digits = 6) {
    const key = fromBase32(secret);
    const counter = Math.floor(timeMs / 1000 / stepSeconds);
    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeBigUInt64BE(BigInt(counter));
    const hmac = createHmac("sha1", key).update(counterBuffer).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const binary = ((hmac[offset] & 0x7f) << 24) |
        ((hmac[offset + 1] & 0xff) << 16) |
        ((hmac[offset + 2] & 0xff) << 8) |
        (hmac[offset + 3] & 0xff);
    const mod = 10 ** digits;
    return (binary % mod).toString().padStart(digits, "0");
}
export function verifyTotpCode(secret, token, window = 1) {
    const normalizedToken = token.trim();
    if (!/^\d{6}$/.test(normalizedToken))
        return false;
    const now = Date.now();
    for (let offset = -window; offset <= window; offset += 1) {
        const candidate = generateTotp(secret, now + offset * 30_000);
        const candidateBuffer = Buffer.from(candidate);
        const tokenBuffer = Buffer.from(normalizedToken);
        if (candidateBuffer.length === tokenBuffer.length && timingSafeEqual(candidateBuffer, tokenBuffer)) {
            return true;
        }
    }
    return false;
}
export function generateMfaSecret() {
    const raw = randomBytes(20);
    return toBase32(raw);
}
export function buildOtpAuthUrl(input) {
    const label = encodeURIComponent(`${env.MFA_ISSUER}:${input.email}`);
    const issuer = encodeURIComponent(env.MFA_ISSUER);
    return `otpauth://totp/${label}?secret=${input.secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
}
function hashBackupCode(code) {
    return createHash("sha256")
        .update(code)
        .update("|")
        .update(env.JWT_SECRET)
        .digest("hex");
}
export function generateBackupCodes(count = 8) {
    const plain = Array.from({ length: count }).map(() => randomBytes(4).toString("hex").toUpperCase());
    const hashed = plain.map((code) => hashBackupCode(code));
    return { plain, hashed };
}
export function consumeBackupCode(code, hashedCodes) {
    const hashed = hashBackupCode(code.trim().toUpperCase());
    const index = hashedCodes.indexOf(hashed);
    if (index === -1) {
        return {
            valid: false,
            remainingHashed: hashedCodes
        };
    }
    const remainingHashed = [...hashedCodes.slice(0, index), ...hashedCodes.slice(index + 1)];
    return {
        valid: true,
        remainingHashed
    };
}
//# sourceMappingURL=securityService.js.map