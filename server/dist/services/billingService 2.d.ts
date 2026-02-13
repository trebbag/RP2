interface BillingInput {
    selectedCodes: string[];
    priorMonthlyRevenueCents?: number;
    expectedCoderLiftPct?: number;
}
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
export {};
