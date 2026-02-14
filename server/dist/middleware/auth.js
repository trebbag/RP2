import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
export function signAuthToken(user) {
    return jwt.sign({
        sub: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        orgId: user.orgId
    }, env.JWT_SECRET, { expiresIn: `${env.SESSION_TTL_HOURS}h` });
}
function parseCookieValue(cookieHeader, key) {
    if (!cookieHeader)
        return null;
    const parts = cookieHeader.split(";");
    for (const part of parts) {
        const [name, ...rest] = part.trim().split("=");
        if (name === key) {
            return decodeURIComponent(rest.join("="));
        }
    }
    return null;
}
function readBearerToken(req) {
    const authHeader = req.headers.authorization;
    if (authHeader) {
        const [scheme, token] = authHeader.split(" ");
        if (scheme === "Bearer" && token)
            return token;
    }
    const cookieToken = parseCookieValue(req.headers.cookie, "rp_token");
    if (cookieToken)
        return cookieToken;
    const queryToken = typeof req.query.access_token === "string" ? req.query.access_token : null;
    const isSseRequest = req.method === "GET" && req.path.endsWith("/transcript/stream");
    if (isSseRequest && queryToken)
        return queryToken;
    return null;
}
export function authenticate(req, res, next) {
    const token = readBearerToken(req);
    if (!token) {
        res.status(401).json({ error: "Authentication required" });
        return;
    }
    try {
        const payload = jwt.verify(token, env.JWT_SECRET);
        if (!payload.orgId) {
            res.status(401).json({ error: "Invalid or expired token" });
            return;
        }
        req.user = {
            id: payload.sub,
            email: payload.email,
            name: payload.name,
            role: payload.role,
            orgId: payload.orgId
        };
        next();
    }
    catch {
        res.status(401).json({ error: "Invalid or expired token" });
    }
}
export function requireRole(roles) {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            res.status(403).json({ error: "Insufficient permissions" });
            return;
        }
        next();
    };
}
//# sourceMappingURL=auth.js.map