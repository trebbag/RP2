import { ZodError } from "zod";
import { logger } from "../lib/logger.js";
export class ApiError extends Error {
    statusCode;
    details;
    constructor(statusCode, message, details) {
        super(message);
        this.statusCode = statusCode;
        this.details = details;
        this.name = "ApiError";
    }
}
export function notFoundHandler(_req, res) {
    res.status(404).json({ error: "Route not found" });
}
export function errorHandler(err, req, res, _next) {
    const baseReq = req;
    const requestId = baseReq.requestId;
    if (err instanceof ZodError) {
        res.status(400).json({
            error: "Validation error",
            issues: err.flatten(),
            requestId
        });
        return;
    }
    if (err instanceof ApiError) {
        res.status(err.statusCode).json({
            error: err.message,
            details: err.details,
            requestId
        });
        return;
    }
    logger.error("Unhandled API error", {
        requestId,
        method: req.method,
        path: req.path,
        err
    });
    res.status(500).json({ error: "Internal server error", requestId });
}
//# sourceMappingURL=errorHandler.js.map