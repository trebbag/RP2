import { z } from "zod";
export const suggestionSchema = z.object({
    code: z.string().min(1),
    codeType: z.string().min(1),
    category: z.enum(["CODE", "DIAGNOSIS", "DIFFERENTIAL", "PREVENTION"]),
    title: z.string().min(1),
    description: z.string().min(1),
    rationale: z.string().min(1),
    confidence: z.number().min(0).max(100),
    evidence: z.array(z.string().min(1)).default([])
});
export const suggestionListSchema = z.array(suggestionSchema).min(1);
export const complianceIssueSchema = z.object({
    severity: z.enum(["CRITICAL", "WARNING", "INFO"]),
    title: z.string().min(1),
    description: z.string().min(1),
    rationale: z.string().min(1),
    remediation: z.string().min(1),
    evidence: z.array(z.string()).default([]),
    fingerprint: z.string().min(1)
});
export const complianceIssueListSchema = z.array(complianceIssueSchema);
export const composeOutputSchema = z.object({
    enhancedNote: z.string().min(1),
    patientSummary: z.string().min(1),
    traceId: z.string().min(1),
    stages: z.array(z.object({
        id: z.number().int().positive(),
        title: z.string().min(1),
        status: z.enum(["pending", "in-progress", "completed"])
    })).length(4)
});
export const billingEstimateSchema = z.object({
    payerModel: z.string().min(1),
    feeScheduleVersion: z.string().min(1),
    feeSchedulePackVersion: z.string().min(1),
    feeScheduleApprovedBy: z.string().min(1),
    feeScheduleApprovedAt: z.string().min(1),
    feeScheduleSource: z.string().min(1),
    selectedCptCodes: z.array(z.string()),
    allowedAmountCents: z.number().int().nonnegative(),
    deductibleAppliedCents: z.number().int().nonnegative(),
    copayCents: z.number().int().nonnegative(),
    coinsuranceCents: z.number().int().nonnegative(),
    estimatedChargeCents: z.number().int().nonnegative(),
    outOfPocketCents: z.number().int().nonnegative(),
    expectedReimbursementCents: z.number().int().nonnegative(),
    projectedRevenueDeltaCents: z.number().int()
});
//# sourceMappingURL=schemas.js.map