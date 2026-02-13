import { z } from "zod";
export declare const suggestionSchema: z.ZodObject<{
    code: z.ZodString;
    codeType: z.ZodString;
    category: z.ZodEnum<{
        CODE: "CODE";
        DIAGNOSIS: "DIAGNOSIS";
        DIFFERENTIAL: "DIFFERENTIAL";
        PREVENTION: "PREVENTION";
    }>;
    title: z.ZodString;
    description: z.ZodString;
    rationale: z.ZodString;
    confidence: z.ZodNumber;
    evidence: z.ZodDefault<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export declare const suggestionListSchema: z.ZodArray<z.ZodObject<{
    code: z.ZodString;
    codeType: z.ZodString;
    category: z.ZodEnum<{
        CODE: "CODE";
        DIAGNOSIS: "DIAGNOSIS";
        DIFFERENTIAL: "DIFFERENTIAL";
        PREVENTION: "PREVENTION";
    }>;
    title: z.ZodString;
    description: z.ZodString;
    rationale: z.ZodString;
    confidence: z.ZodNumber;
    evidence: z.ZodDefault<z.ZodArray<z.ZodString>>;
}, z.core.$strip>>;
export declare const complianceIssueSchema: z.ZodObject<{
    severity: z.ZodEnum<{
        INFO: "INFO";
        CRITICAL: "CRITICAL";
        WARNING: "WARNING";
    }>;
    title: z.ZodString;
    description: z.ZodString;
    rationale: z.ZodString;
    remediation: z.ZodString;
    evidence: z.ZodDefault<z.ZodArray<z.ZodString>>;
    fingerprint: z.ZodString;
}, z.core.$strip>;
export declare const complianceIssueListSchema: z.ZodArray<z.ZodObject<{
    severity: z.ZodEnum<{
        INFO: "INFO";
        CRITICAL: "CRITICAL";
        WARNING: "WARNING";
    }>;
    title: z.ZodString;
    description: z.ZodString;
    rationale: z.ZodString;
    remediation: z.ZodString;
    evidence: z.ZodDefault<z.ZodArray<z.ZodString>>;
    fingerprint: z.ZodString;
}, z.core.$strip>>;
export declare const composeOutputSchema: z.ZodObject<{
    enhancedNote: z.ZodString;
    patientSummary: z.ZodString;
    traceId: z.ZodString;
    stages: z.ZodArray<z.ZodObject<{
        id: z.ZodNumber;
        title: z.ZodString;
        status: z.ZodEnum<{
            pending: "pending";
            "in-progress": "in-progress";
            completed: "completed";
        }>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const billingEstimateSchema: z.ZodObject<{
    payerModel: z.ZodString;
    feeScheduleVersion: z.ZodString;
    feeSchedulePackVersion: z.ZodString;
    feeScheduleApprovedBy: z.ZodString;
    feeScheduleApprovedAt: z.ZodString;
    feeScheduleSource: z.ZodString;
    selectedCptCodes: z.ZodArray<z.ZodString>;
    allowedAmountCents: z.ZodNumber;
    deductibleAppliedCents: z.ZodNumber;
    copayCents: z.ZodNumber;
    coinsuranceCents: z.ZodNumber;
    estimatedChargeCents: z.ZodNumber;
    outOfPocketCents: z.ZodNumber;
    expectedReimbursementCents: z.ZodNumber;
    projectedRevenueDeltaCents: z.ZodNumber;
}, z.core.$strip>;
