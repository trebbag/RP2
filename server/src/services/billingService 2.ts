import { billingEstimateSchema } from "./schemas.js"

const CPT_CHARGE_TABLE_CENTS: Record<string, number> = {
  "99212": 9142,
  "99213": 12742,
  "99214": 18493,
  "99215": 23812,
  "93000": 5178,
  "80061": 2390
}

interface BillingInput {
  selectedCodes: string[]
  priorMonthlyRevenueCents?: number
  expectedCoderLiftPct?: number
}

export function calculateBillingEstimate(input: BillingInput) {
  const selectedCptCodes = input.selectedCodes.filter((code) => /^\d{5}$/.test(code))

  const estimatedChargeCents = selectedCptCodes.reduce(
    (sum, code) => sum + (CPT_CHARGE_TABLE_CENTS[code] ?? 6500),
    0
  )

  const outOfPocketCents = Math.round(estimatedChargeCents * 0.2)
  const expectedReimbursementCents = Math.max(estimatedChargeCents - outOfPocketCents, 0)

  const priorMonthlyRevenueCents = input.priorMonthlyRevenueCents ?? 1_000_000
  const expectedCoderLiftPct = input.expectedCoderLiftPct ?? 0.035
  const projectedRevenueDeltaCents = Math.round(priorMonthlyRevenueCents * expectedCoderLiftPct)

  return billingEstimateSchema.parse({
    selectedCptCodes,
    estimatedChargeCents,
    outOfPocketCents,
    expectedReimbursementCents,
    projectedRevenueDeltaCents
  })
}

export function formatUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(cents / 100)
}
