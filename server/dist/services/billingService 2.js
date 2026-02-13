import { billingEstimateSchema } from "./schemas.js";
const CPT_CHARGE_TABLE_CENTS = {
    "99212": 9142,
    "99213": 12742,
    "99214": 18493,
    "99215": 23812,
    "93000": 5178,
    "80061": 2390
};
export function calculateBillingEstimate(input) {
    const selectedCptCodes = input.selectedCodes.filter((code) => /^\d{5}$/.test(code));
    const estimatedChargeCents = selectedCptCodes.reduce((sum, code) => sum + (CPT_CHARGE_TABLE_CENTS[code] ?? 6500), 0);
    const outOfPocketCents = Math.round(estimatedChargeCents * 0.2);
    const expectedReimbursementCents = Math.max(estimatedChargeCents - outOfPocketCents, 0);
    const priorMonthlyRevenueCents = input.priorMonthlyRevenueCents ?? 1_000_000;
    const expectedCoderLiftPct = input.expectedCoderLiftPct ?? 0.035;
    const projectedRevenueDeltaCents = Math.round(priorMonthlyRevenueCents * expectedCoderLiftPct);
    return billingEstimateSchema.parse({
        selectedCptCodes,
        estimatedChargeCents,
        outOfPocketCents,
        expectedReimbursementCents,
        projectedRevenueDeltaCents
    });
}
export function formatUsd(cents) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD"
    }).format(cents / 100);
}
//# sourceMappingURL=billingService%202.js.map