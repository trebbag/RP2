import { randomUUID } from "node:crypto";
import { logger } from "../lib/logger.js";
export function requestContext(req, res, next) {
    const requestId = req.header("x-request-id") || randomUUID();
    req.requestId = requestId;
    res.setHeader("x-request-id", requestId);
    const start = Date.now();
    logger.info("request.start", {
        requestId,
        method: req.method,
        path: req.path,
        ip: req.ip
    });
    res.on("finish", () => {
        logger.info("request.finish", {
            requestId,
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            durationMs: Date.now() - start
        });
    });
    next();
}
//# sourceMappingURL=requestContext.js.map