import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { __resetBillingScheduleCacheForTests, calculateBillingEstimate } from "../src/services/billingService.js"

test("calculateBillingEstimate calculates totals from selected CPT codes", () => {
  const result = calculateBillingEstimate({
    selectedCodes: ["99213", "93000", "I25.10"],
    payerModel: "AETNA_PPO",
    deductibleRemainingCents: 2000,
    coinsurancePct: 0.1,
    copayCents: 3000,
    priorMonthlyRevenueCents: 2_000_000,
    expectedCoderLiftPct: 0.05
  })

  assert.equal(result.payerModel, "AETNA_PPO")
  assert.deepEqual(result.selectedCptCodes, ["99213", "93000"])
  assert.ok(result.allowedAmountCents > 0)
  assert.ok(result.deductibleAppliedCents >= 0)
  assert.ok(result.coinsuranceCents >= 0)
  assert.ok(result.copayCents >= 0)
  assert.ok(result.estimatedChargeCents > 0)
  assert.ok(result.expectedReimbursementCents <= result.estimatedChargeCents)
  assert.equal(result.projectedRevenueDeltaCents, 100000)
  assert.equal(result.feeSchedulePackVersion, "payer-approved-2026.02")
  assert.ok(result.feeScheduleApprovedBy.length > 0)
  assert.ok(result.feeScheduleSource.length > 0)
})

test("calculateBillingEstimate falls back to baseline values", () => {
  const result = calculateBillingEstimate({ selectedCodes: [] })
  assert.equal(result.payerModel, "MEDICARE")
  assert.equal(result.estimatedChargeCents, 0)
  assert.equal(result.expectedReimbursementCents, 0)
})

test("calculateBillingEstimate supports approved schedule override pack via file config", () => {
  const previousPath = process.env.BILLING_SCHEDULES_PATH
  const tmpPath = path.resolve(os.tmpdir(), `rp2-billing-pack-${Date.now()}.json`)

  const customPack = {
    packVersion: "payer-approved-override-test",
    updatedAt: new Date().toISOString(),
    updatedBy: "Billing Test",
    schedules: {
      MEDICARE: {
        version: "CMS-TEST",
        payerModel: "MEDICARE",
        approval: {
          approvedBy: "Billing Test Board",
          approvedAt: "2026-02-11",
          source: "Unit test source"
        },
        defaultRateCents: 10000,
        cptRatesCents: {
          "99213": 20000
        },
        defaultCoinsurancePct: 0.2,
        defaultCopayCents: 0,
        rules: {
          requireAtLeastOneCpt: false,
          maxCoinsurancePct: 0.4,
          maxCopayCents: 10000
        }
      },
      AETNA_PPO: {
        version: "AETNA-TEST",
        payerModel: "AETNA_PPO",
        approval: { approvedBy: "Billing Test Board", approvedAt: "2026-02-11", source: "Unit test source" },
        defaultRateCents: 11000,
        cptRatesCents: { "99213": 11000 },
        defaultCoinsurancePct: 0.2,
        defaultCopayCents: 0,
        rules: { requireAtLeastOneCpt: false, maxCoinsurancePct: 0.5, maxCopayCents: 10000 }
      },
      BCBS_PPO: {
        version: "BCBS-TEST",
        payerModel: "BCBS_PPO",
        approval: { approvedBy: "Billing Test Board", approvedAt: "2026-02-11", source: "Unit test source" },
        defaultRateCents: 12000,
        cptRatesCents: { "99213": 12000 },
        defaultCoinsurancePct: 0.2,
        defaultCopayCents: 0,
        rules: { requireAtLeastOneCpt: false, maxCoinsurancePct: 0.5, maxCopayCents: 10000 }
      },
      SELF_PAY: {
        version: "SELF-TEST",
        payerModel: "SELF_PAY",
        approval: { approvedBy: "Billing Test Board", approvedAt: "2026-02-11", source: "Unit test source" },
        defaultRateCents: 9000,
        cptRatesCents: { "99213": 9000 },
        defaultCoinsurancePct: 1,
        defaultCopayCents: 0,
        rules: { requireAtLeastOneCpt: false, maxCoinsurancePct: 1, maxCopayCents: 0 }
      }
    }
  }

  fs.writeFileSync(tmpPath, JSON.stringify(customPack, null, 2), "utf8")
  process.env.BILLING_SCHEDULES_PATH = tmpPath
  __resetBillingScheduleCacheForTests()

  try {
    const result = calculateBillingEstimate({
      selectedCodes: ["99213"],
      payerModel: "MEDICARE"
    })

    assert.equal(result.allowedAmountCents, 20000)
    assert.equal(result.feeScheduleVersion, "CMS-TEST")
    assert.equal(result.feeSchedulePackVersion, "payer-approved-override-test")
    assert.equal(result.feeScheduleApprovedBy, "Billing Test Board")
  } finally {
    fs.rmSync(tmpPath, { force: true })
    if (previousPath === undefined) {
      delete process.env.BILLING_SCHEDULES_PATH
    } else {
      process.env.BILLING_SCHEDULES_PATH = previousPath
    }
    __resetBillingScheduleCacheForTests()
  }
})
