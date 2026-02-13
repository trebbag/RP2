import type { NextFunction, Response } from "express";
import type { UserRole } from "@prisma/client";
import type { AuthenticatedRequest, AuthUser } from "../types.js";
export declare function signAuthToken(user: AuthUser): string;
export declare function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): void;
export declare function requireRole(roles: UserRole[]): (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
