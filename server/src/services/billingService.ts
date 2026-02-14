import fs from "node:fs"
import path from "node:path"
import { z } from "zod"
import { billingEstimateSchema } from "./schemas.js"

export const SUPPORTED_PAYER_MODELS = ["MEDICARE", "AETNA_PPO", "BCBS_PPO", "SELF_PAY"] as const
export type PayerModel = (typeof SUPPORTED_PAYER_MODELS)[number]

const payerModelSchema = z.enum(SUPPORTED_PAYER_MODELS)

const feeScheduleSchema = z.object({
  version: z.string().min(1),
  payerModel: payerModelSchema,
  approval: z.object({
    approvedBy: z.string().min(1),
    approvedAt: z.string().min(1),
    source: z.string().min(1)
  }),
  defaultRateCents: z.number().int().positive(),
  cptRatesCents: z.record(z.string().regex(/^\d{5}$/), z.number().int().positive()),
  defaultCoinsurancePct: z.number().min(0).max(1),
  defaultCopayCents: z.number().int().nonnegative(),
  rules: z.object({
    requireAtLeastOneCpt: z.boolean(),
    maxCoinsurancePct: z.number().min(0).max(1),
    maxCopayCents: z.number().int().nonnegative()
  })
})

const billingSchedulePackSchema = z.object({
  packVersion: z.string().min(1),
  updatedAt: z.string().min(1),
  updatedBy: z.string().min(1),
  schedules: z.object({
    MEDICARE: feeScheduleSchema.extend({ payerModel: z.literal("MEDICARE") }),
    AETNA_PPO: feeScheduleSchema.extend({ payerModel: z.literal("AETNA_PPO") }),
    BCBS_PPO: feeScheduleSchema.extend({ payerModel: z.literal("BCBS_PPO") }),
    SELF_PAY: feeScheduleSchema.extend({ payerModel: z.literal("SELF_PAY") })
  })
})

type FeeSchedule = z.infer<typeof feeScheduleSchema>
export type BillingSchedulePack = z.infer<typeof billingSchedulePackSchema>

const DEFAULT_BILLING_SCHEDULE_PACK: BillingSchedulePack = {
  packVersion: "payer-approved-2026.02",
  updatedAt: "2026-02-01T00:00:00.000Z",
  updatedBy: "RevenuePilot Finance Committee",
  schedules: {
    MEDICARE: {
      version: "CMS-2026.01",
      payerModel: "MEDICARE",
      approval: {
        approvedBy: "RevenuePilot Finance Committee",
        approvedAt: "2026-02-01",
        source: "CMS Physician Fee Schedule 2026"
      },
      defaultRateCents: 8800,
      cptRatesCents: {
        "99212": 9050,
        "99213": 12620,
        "99214": 18450,
        "99215": 23690,
        "93000": 5100,
        "80061": 2350
      },
      defaultCoinsurancePct: 0.2,
      defaultCopayCents: 0,
      rules: {
        requireAtLeastOneCpt: false,
        maxCoinsurancePct: 0.4,
        maxCopayCents: 15000
      }
    },
    AETNA_PPO: {
      version: "AETNA-2026.01",
      payerModel: "AETNA_PPO",
      approval: {
        approvedBy: "RevenuePilot Finance Committee",
        approvedAt: "2026-02-01",
        source: "Aetna PPO contracted rates pilot pack"
      },
      defaultRateCents: 9900,
      cptRatesCents: {
        "99212": 10450,
        "99213": 14600,
        "99214": 21000,
        "99215": 26900,
        "93000": 5900,
        "80061": 2900
      },
      defaultCoinsurancePct: 0.15,
      defaultCopayCents: 3500,
      rules: {
        requireAtLeastOneCpt: false,
        maxCoinsurancePct: 0.5,
        maxCopayCents: 25000
      }
    },
    BCBS_PPO: {
      version: "BCBS-2026.01",
      payerModel: "BCBS_PPO",
      approval: {
        approvedBy: "RevenuePilot Finance Committee",
        approvedAt: "2026-02-01",
        source: "BCBS PPO contracted rates pilot pack"
      },
      defaultRateCents: 9700,
      cptRatesCents: {
        "99212": 10100,
        "99213": 14250,
        "99214": 20500,
        "99215": 26200,
        "93000": 5750,
        "80061": 2800
      },
      defaultCoinsurancePct: 0.18,
      defaultCopayCents: 3000,
      rules: {
        requireAtLeastOneCpt: false,
        maxCoinsurancePct: 0.5,
        maxCopayCents: 25000
      }
    },
    SELF_PAY: {
      version: "SELFPAY-2026.01",
      payerModel: "SELF_PAY",
      approval: {
        approvedBy: "RevenuePilot Finance Committee",
        approvedAt: "2026-02-01",
        source: "Clinic self-pay schedule"
      },
      defaultRateCents: 7000,
      cptRatesCents: {
        "99212": 7600,
        "99213": 9900,
        "99214": 13700,
        "99215": 17000,
        "93000": 4300,
        "80061": 1900
      },
      defaultCoinsurancePct: 1,
      defaultCopayCents: 0,
      rules: {
        requireAtLeastOneCpt: false,
        maxCoinsurancePct: 1,
        maxCopayCents: 0
      }
    }
  }
}

interface BillingInput {
  selectedCodes: string[]
  payerModel?: string
  priorMonthlyRevenueCents?: number
  expectedCoderLiftPct?: number
  deductibleRemainingCents?: number
  coinsurancePct?: number
  copayCents?: number
}

let cachedPack: BillingSchedulePack | null = null
let cachedPackPath: string | null = null
let cachedPackMtimeMs = -1

function resolveScheduleConfigPath(): string | null {
  const runtimePathOverride = process.env.BILLING_SCHEDULES_PATH?.trim()
  const candidates = [
    runtimePathOverride,
    path.resolve(process.cwd(), "server", "config", "billing-fee-schedules.json"),
    path.resolve(process.cwd(), "config", "billing-fee-schedules.json"),
    path.resolve(process.cwd(), "billing-fee-schedules.json")
  ].filter((candidate): candidate is string => Boolean(candidate && candidate.trim().length > 0))

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }

  return null
}

function loadPackFromFile(filePath: string): BillingSchedulePack {
  const stat = fs.statSync(filePath)
  if (cachedPack && cachedPackPath === filePath && cachedPackMtimeMs === stat.mtimeMs) {
    return cachedPack
  }

  const raw = fs.readFileSync(filePath, "utf8")
  const parsed = billingSchedulePackSchema.parse(JSON.parse(raw))

  cachedPack = parsed
  cachedPackPath = filePath
  cachedPackMtimeMs = stat.mtimeMs
  return parsed
}

function loadBillingSchedulePack(): BillingSchedulePack {
  const filePath = resolveScheduleConfigPath()
  if (!filePath) {
    return DEFAULT_BILLING_SCHEDULE_PACK
  }

  return loadPackFromFile(filePath)
}

function resolveWritableSchedulePath(): string {
  const runtimePathOverride = process.env.BILLING_SCHEDULES_PATH?.trim()
  if (runtimePathOverride) {
    return runtimePathOverride
  }

  if (process.cwd().endsWith(`${path.sep}server`)) {
    return path.resolve(process.cwd(), "config", "billing-fee-schedules.json")
  }

  return path.resolve(process.cwd(), "server", "config", "billing-fee-schedules.json")
}

function normalizePayerModel(model?: string): PayerModel {
  if (!model) return "MEDICARE"
  const normalized = model.toUpperCase() as PayerModel
  return SUPPORTED_PAYER_MODELS.includes(normalized) ? normalized : "MEDICARE"
}

function resolveSchedule(model?: string): { payerModel: PayerModel; schedule: FeeSchedule; pack: BillingSchedulePack } {
  const pack = loadBillingSchedulePack()
  const payerModel = normalizePayerModel(model)
  return {
    payerModel,
    schedule: pack.schedules[payerModel],
    pack
  }
}

export function getBillingSchedulePack(): BillingSchedulePack {
  return loadBillingSchedulePack()
}

export function saveBillingSchedulePack(input: { pack: unknown; actor: string }) {
  const parsed = billingSchedulePackSchema.parse(input.pack)
  const updated: BillingSchedulePack = {
    ...parsed,
    updatedAt: new Date().toISOString(),
    updatedBy: input.actor
  }

  const targetPath = resolveWritableSchedulePath()
  fs.mkdirSync(path.dirname(targetPath), { recursive: true })
  fs.writeFileSync(targetPath, `${JSON.stringify(updated, null, 2)}\n`, "utf8")

  cachedPack = updated
  cachedPackPath = targetPath
  cachedPackMtimeMs = fs.statSync(targetPath).mtimeMs

  return {
    path: targetPath,
    pack: updated
  }
}

export function calculateBillingEstimate(input: BillingInput) {
  const { payerModel, schedule, pack } = resolveSchedule(input.payerModel)
  const selectedCptCodes = input.selectedCodes.filter((code) => /^\d{5}$/.test(code))

  if (schedule.rules.requireAtLeastOneCpt && selectedCptCodes.length === 0) {
    throw new Error(`Payer model ${payerModel} requires at least one CPT code before billing estimation.`)
  }

  const allowedAmountCents = selectedCptCodes.reduce(
    (sum, code) => sum + (schedule.cptRatesCents[code] ?? schedule.defaultRateCents),
    0
  )

  const estimatedChargeCents = allowedAmountCents

  const deductibleRemainingCents = Math.max(0, input.deductibleRemainingCents ?? 0)
  const deductibleAppliedCents = Math.min(allowedAmountCents, deductibleRemainingCents)
  const remainingAfterDeductibleCents = Math.max(0, allowedAmountCents - deductibleAppliedCents)

  const requestedCoinsurancePct = input.coinsurancePct ?? schedule.defaultCoinsurancePct
  const appliedCoinsurancePct = Math.min(schedule.rules.maxCoinsurancePct, Math.max(0, requestedCoinsurancePct))
  const coinsuranceCents = Math.round(remainingAfterDeductibleCents * appliedCoinsurancePct)

  const requestedCopayCents = Math.max(0, input.copayCents ?? schedule.defaultCopayCents)
  const appliedCopayCents = Math.min(requestedCopayCents, schedule.rules.maxCopayCents)
  const copayCents = selectedCptCodes.length > 0 ? appliedCopayCents : 0

  const outOfPocketCents = Math.min(allowedAmountCents, deductibleAppliedCents + coinsuranceCents + copayCents)
  const expectedReimbursementCents = Math.max(allowedAmountCents - outOfPocketCents, 0)

  const priorMonthlyRevenueCents = input.priorMonthlyRevenueCents ?? 1_000_000
  const expectedCoderLiftPct = input.expectedCoderLiftPct ?? 0.035
  const projectedRevenueDeltaCents = Math.round(priorMonthlyRevenueCents * expectedCoderLiftPct)

  return billingEstimateSchema.parse({
    payerModel,
    feeScheduleVersion: schedule.version,
    feeSchedulePackVersion: pack.packVersion,
    feeScheduleApprovedBy: schedule.approval.approvedBy,
    feeScheduleApprovedAt: schedule.approval.approvedAt,
    feeScheduleSource: schedule.approval.source,
    selectedCptCodes,
    allowedAmountCents,
    deductibleAppliedCents,
    copayCents,
    coinsuranceCents,
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

export function __resetBillingScheduleCacheForTests() {
  cachedPack = null
  cachedPackPath = null
  cachedPackMtimeMs = -1
}
