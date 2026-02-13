import { z } from "zod";
export declare const SUPPORTED_PAYER_MODELS: readonly ["MEDICARE", "AETNA_PPO", "BCBS_PPO", "SELF_PAY"];
export type PayerModel = (typeof SUPPORTED_PAYER_MODELS)[number];
declare const billingSchedulePackSchema: z.ZodObject<{
    packVersion: z.ZodString;
    updatedAt: z.ZodString;
    updatedBy: z.ZodString;
    schedules: z.ZodObject<{
        MEDICARE: z.ZodObject<{
            version: z.ZodString;
            approval: z.ZodObject<{
                approvedBy: z.ZodString;
                approvedAt: z.ZodString;
                source: z.ZodString;
            }, z.core.$strip>;
            defaultRateCents: z.ZodNumber;
            cptRatesCents: z.ZodRecord<z.ZodString, z.ZodNumber>;
            defaultCoinsurancePct: z.ZodNumber;
            defaultCopayCents: z.ZodNumber;
            rules: z.ZodObject<{
                requireAtLeastOneCpt: z.ZodBoolean;
                maxCoinsurancePct: z.ZodNumber;
                maxCopayCents: z.ZodNumber;
            }, z.core.$strip>;
            payerModel: z.ZodLiteral<"MEDICARE">;
        }, z.core.$strip>;
        AETNA_PPO: z.ZodObject<{
            version: z.ZodString;
            approval: z.ZodObject<{
                approvedBy: z.ZodString;
                approvedAt: z.ZodString;
                source: z.ZodString;
            }, z.core.$strip>;
            defaultRateCents: z.ZodNumber;
            cptRatesCents: z.ZodRecord<z.ZodString, z.ZodNumber>;
            defaultCoinsurancePct: z.ZodNumber;
            defaultCopayCents: z.ZodNumber;
            rules: z.ZodObject<{
                requireAtLeastOneCpt: z.ZodBoolean;
                maxCoinsurancePct: z.ZodNumber;
                maxCopayCents: z.ZodNumber;
            }, z.core.$strip>;
            payerModel: z.ZodLiteral<"AETNA_PPO">;
        }, z.core.$strip>;
        BCBS_PPO: z.ZodObject<{
            version: z.ZodString;
            approval: z.ZodObject<{
                approvedBy: z.ZodString;
                approvedAt: z.ZodString;
                source: z.ZodString;
            }, z.core.$strip>;
            defaultRateCents: z.ZodNumber;
            cptRatesCents: z.ZodRecord<z.ZodString, z.ZodNumber>;
            defaultCoinsurancePct: z.ZodNumber;
            defaultCopayCents: z.ZodNumber;
            rules: z.ZodObject<{
                requireAtLeastOneCpt: z.ZodBoolean;
                maxCoinsurancePct: z.ZodNumber;
                maxCopayCents: z.ZodNumber;
            }, z.core.$strip>;
            payerModel: z.ZodLiteral<"BCBS_PPO">;
        }, z.core.$strip>;
        SELF_PAY: z.ZodObject<{
            version: z.ZodString;
            approval: z.ZodObject<{
                approvedBy: z.ZodString;
                approvedAt: z.ZodString;
                source: z.ZodString;
            }, z.core.$strip>;
            defaultRateCents: z.ZodNumber;
            cptRatesCents: z.ZodRecord<z.ZodString, z.ZodNumber>;
            defaultCoinsurancePct: z.ZodNumber;
            defaultCopayCents: z.ZodNumber;
            rules: z.ZodObject<{
                requireAtLeastOneCpt: z.ZodBoolean;
                maxCoinsurancePct: z.ZodNumber;
                maxCopayCents: z.ZodNumber;
            }, z.core.$strip>;
            payerModel: z.ZodLiteral<"SELF_PAY">;
        }, z.core.$strip>;
    }, z.core.$strip>;
}, z.core.$strip>;
export type BillingSchedulePack = z.infer<typeof billingSchedulePackSchema>;
interface BillingInput {
    selectedCodes: string[];
    payerModel?: string;
    priorMonthlyRevenueCents?: number;
    expectedCoderLiftPct?: number;
    deductibleRemainingCents?: number;
    coinsurancePct?: number;
    copayCents?: number;
}
export declare function getBillingSchedulePack(): BillingSchedulePack;
export declare function saveBillingSchedulePack(input: {
    pack: unknown;
    actor: string;
}): {
    path: string;
    pack: {
        packVersion: string;
        updatedAt: string;
        updatedBy: string;
        schedules: {
            MEDICARE: {
                version: string;
                approval: {
                    approvedBy: string;
                    approvedAt: string;
                    source: string;
                };
                defaultRateCents: number;
                cptRatesCents: Record<string, number>;
                defaultCoinsurancePct: number;
                defaultCopayCents: number;
                rules: {
                    requireAtLeastOneCpt: boolean;
                    maxCoinsurancePct: number;
                    maxCopayCents: number;
                };
                payerModel: "MEDICARE";
            };
            AETNA_PPO: {
                version: string;
                approval: {
                    approvedBy: string;
                    approvedAt: string;
                    source: string;
                };
                defaultRateCents: number;
                cptRatesCents: Record<string, number>;
                defaultCoinsurancePct: number;
                defaultCopayCents: number;
                rules: {
                    requireAtLeastOneCpt: boolean;
                    maxCoinsurancePct: number;
                    maxCopayCents: number;
                };
                payerModel: "AETNA_PPO";
            };
            BCBS_PPO: {
                version: string;
                approval: {
                    approvedBy: string;
                    approvedAt: string;
                    source: string;
                };
                defaultRateCents: number;
                cptRatesCents: Record<string, number>;
                defaultCoinsurancePct: number;
                defaultCopayCents: number;
                rules: {
                    requireAtLeastOneCpt: boolean;
                    maxCoinsurancePct: number;
                    maxCopayCents: number;
                };
                payerModel: "BCBS_PPO";
            };
            SELF_PAY: {
                version: string;
                approval: {
                    approvedBy: string;
                    approvedAt: string;
                    source: string;
                };
                defaultRateCents: number;
                cptRatesCents: Record<string, number>;
                defaultCoinsurancePct: number;
                defaultCopayCents: number;
                rules: {
                    requireAtLeastOneCpt: boolean;
                    maxCoinsurancePct: number;
                    maxCopayCents: number;
                };
                payerModel: "SELF_PAY";
            };
        };
    };
};
export declare function calculateBillingEstimate(input: BillingInput): {
    payerModel: string;
    feeScheduleVersion: string;
    feeSchedulePackVersion: string;
    feeScheduleApprovedBy: string;
    feeScheduleApprovedAt: string;
    feeScheduleSource: string;
    selectedCptCodes: string[];
    allowedAmountCents: number;
    deductibleAppliedCents: number;
    copayCents: number;
    coinsuranceCents: number;
    estimatedChargeCents: number;
    outOfPocketCents: number;
    expectedReimbursementCents: number;
    projectedRevenueDeltaCents: number;
};
export declare function formatUsd(cents: number): string;
export declare function __resetBillingScheduleCacheForTests(): void;
export {};
