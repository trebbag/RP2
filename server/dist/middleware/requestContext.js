import { randomUUID } from "node:crypto";
import { logger } from "../lib/logger.js";
export function requestContext(req, res, next) {
    const requestId = req.header("x-request-id") || randomUUID();
    req.requestId = requestId;
    res.setHeader("x-request-id", requestId);
    const start = Date.now();
    res.on("finish", () => {
        logger.info("request", {
            requestId,
            endpoint: `${req.method} ${req.path}`,
            statusCode: res.statusCode,
            durationMs: Date.now() - start
        });
    });
    next();
}
//# sourceMappingURL=requestContext.js.map