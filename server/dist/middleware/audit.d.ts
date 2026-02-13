import type { Request, Response } from "express";
interface AuditInput {
    req: Request;
    res: Response;
    action: string;
    entity: string;
    entityId: string;
    encounterId?: string;
    details?: unknown;
}
interface SystemAuditInput {
    action: string;
    entity: string;
    entityId: string;
    actorId?: string;
    encounterId?: string;
    details?: unknown;
}
export declare function writeAuditLog(input: AuditInput): Promise<void>;
export declare function writeSystemAuditLog(input: SystemAuditInput): Promise<void>;
export {};
