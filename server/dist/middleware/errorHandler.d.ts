import type { NextFunction, Request, Response } from "express";
export declare class ApiError extends Error {
    readonly statusCode: number;
    readonly details?: unknown;
    constructor(statusCode: number, message: string, details?: unknown);
}
export declare function notFoundHandler(_req: Request, res: Response): void;
export declare function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void;
