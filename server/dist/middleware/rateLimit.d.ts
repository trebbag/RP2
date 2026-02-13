import type { NextFunction, Request, Response } from "express";
export declare const authLoginRateLimiter: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const authRefreshRateLimiter: (req: Request, res: Response, next: NextFunction) => Promise<void>;
