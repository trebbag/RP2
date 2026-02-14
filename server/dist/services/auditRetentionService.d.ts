interface AuditRetentionInput {
    orgId: string;
    now?: Date;
    dryRun?: boolean;
}
export interface AuditRetentionReport {
    retentionDays: number;
    cutoffIso: string;
    dryRun: boolean;
    eligibleCount: number;
    deletedCount: number;
}
export declare function runAuditRetentionPolicy(input: AuditRetentionInput): Promise<AuditRetentionReport>;
export {};
