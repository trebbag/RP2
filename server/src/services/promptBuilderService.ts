import { createHash } from "node:crypto"
import { prisma } from "../lib/prisma.js"
import {
  defaultUserSettings,
  normalizeUserSettingsPayload,
  type UserSettingsPayload
} from "./settingsService.js"

export type AiPromptTask = "suggestions" | "compliance" | "compose" | "diarization"

export interface PromptProfile {
  specialty: string
  payer: string
  region: string
  guidelines: string[]
  summaryLanguage: string
  promptOverridesRaw: string
}

export interface PromptBundle {
  task: AiPromptTask
  versionId: string
  instructions: string
  metadata: {
    profileDigest: string
    overridesApplied: boolean
  }
}

interface PromptBuildInput {
  task: AiPromptTask
  profile?: PromptProfile
  runtimeContext?: Record<string, unknown>
}

const PROMPT_BASE_VERSION = "2026.02.11"
const OVERRIDE_TEXT_LIMIT = 2000

const TASK_INSTRUCTIONS: Record<AiPromptTask, string[]> = {
  suggestions: [
    "You are a medical coding assistant for outpatient clinical documentation.",
    "Generate coding and clinical suggestions from note content, transcript snippets, and chart context.",
    "Return only JSON array items with fields:",
    "`code`, `codeType`, `category`, `title`, `description`, `rationale`, `confidence`, `evidence`.",
    "Rules:",
    "- category must be one of CODE, DIAGNOSIS, DIFFERENTIAL, PREVENTION.",
    "- confidence is 0-100 number.",
    "- evidence should include short supporting spans from the provided input.",
    "- avoid duplicates by code.",
    "- avoid speculative diagnosis claims without supporting evidence in supplied text."
  ],
  compliance: [
    "You are a clinical documentation compliance reviewer.",
    "Assess denial-risk and documentation quality for a draft encounter note and selected billing codes.",
    "Return only JSON array items with fields:",
    "`severity`, `title`, `description`, `rationale`, `remediation`, `evidence`, `fingerprint`.",
    "Rules:",
    "- severity must be CRITICAL, WARNING, or INFO.",
    "- fingerprint must be stable and deterministic per issue title.",
    "- include payer-denial risk language for CRITICAL and WARNING issues."
  ],
  compose: [
    "You are a medical documentation composer.",
    "Given an original clinical note and patient name, produce:",
    "- enhancedNote: professionally structured and concise clinician-facing note.",
    "- patientSummary: plain-language summary for patient handoff.",
    "- traceId: short identifier prefixed with trace_.",
    "- stages: exactly four completed stages:",
    "  1 Analyzing Content",
    "  2 Enhancing Structure",
    "  3 Beautifying Language",
    "  4 Final Review."
  ],
  diarization: [
    "You are a medical transcript diarization model.",
    "Split transcript text into speaker-attributed segments for a clinical encounter.",
    "Return JSON object with `segments` array.",
    "Use likely speaker labels and preserve wording.",
    "If unclear, default to provided speaker hint."
  ]
}

function normalizeProfile(settings: UserSettingsPayload): PromptProfile {
  return {
    specialty: settings.clinical.specialty,
    payer: settings.clinical.payer,
    region: settings.clinical.region,
    guidelines: settings.clinical.guidelines,
    summaryLanguage: settings.language.summaryLanguage,
    promptOverridesRaw: settings.advanced.promptOverrides
  }
}

function asTrimmedStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
}

function parsePromptOverrides(raw: string): {
  normalizedText: string
  globalLines: string[]
  taskLines: string[]
  applied: boolean
} {
  const normalizedText = raw.trim()
  if (!normalizedText) {
    return {
      normalizedText: "",
      globalLines: [],
      taskLines: [],
      applied: false
    }
  }

  try {
    const parsed = JSON.parse(normalizedText) as Record<string, unknown>
    const globalLines = [
      ...asTrimmedStringArray(parsed.global_instructions),
      ...asTrimmedStringArray(parsed.globalInstructions)
    ]
    return {
      normalizedText: JSON.stringify(parsed),
      globalLines,
      taskLines: [],
      applied: globalLines.length > 0 || Object.keys(parsed).length > 0
    }
  } catch {
    return {
      normalizedText,
      globalLines: [],
      taskLines: [],
      applied: true
    }
  }
}

function extractTaskOverrides(raw: string, task: AiPromptTask): string[] {
  if (!raw.trim()) return []

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const taskMap = (parsed.task_instructions || parsed.taskInstructions || parsed.tasks) as
      | Record<string, unknown>
      | undefined
    if (!taskMap || typeof taskMap !== "object") return []
    return asTrimmedStringArray(taskMap[task])
  } catch {
    return []
  }
}

function stringifyContextBlock(runtimeContext?: Record<string, unknown>): string[] {
  if (!runtimeContext || Object.keys(runtimeContext).length === 0) return []
  const lines = Object.entries(runtimeContext)
    .map(([key, value]) => {
      if (typeof value === "undefined" || value === null) return null
      if (Array.isArray(value)) return `- ${key}: ${value.join(", ")}`
      if (typeof value === "object") return `- ${key}: ${JSON.stringify(value)}`
      return `- ${key}: ${String(value)}`
    })
    .filter((line): line is string => Boolean(line))

  if (lines.length === 0) return []
  return ["Runtime context:", ...lines]
}

function truncateForPrompt(value: string, maxChars = OVERRIDE_TEXT_LIMIT): string {
  if (value.length <= maxChars) return value
  return `${value.slice(0, maxChars)}...`
}

function buildVersionId(input: {
  task: AiPromptTask
  profile: PromptProfile
  runtimeContext?: Record<string, unknown>
  normalizedOverrides: string
}) {
  const digest = createHash("sha256")
    .update(PROMPT_BASE_VERSION)
    .update("|")
    .update(input.task)
    .update("|")
    .update(JSON.stringify(input.profile))
    .update("|")
    .update(input.normalizedOverrides)
    .update("|")
    .update(JSON.stringify(input.runtimeContext ?? {}))
    .digest("hex")
    .slice(0, 16)
  return `prompt-${PROMPT_BASE_VERSION}-${input.task}-${digest}`
}

export async function loadPromptProfileForUser(userId?: string): Promise<PromptProfile> {
  if (!userId) {
    return normalizeProfile(defaultUserSettings)
  }

  const settings = await prisma.userSettings.findUnique({
    where: { userId },
    select: { payload: true }
  })

  return normalizeProfile(normalizeUserSettingsPayload(settings?.payload))
}

export function buildPromptBundle(input: PromptBuildInput): PromptBundle {
  const profile = input.profile ?? normalizeProfile(defaultUserSettings)
  const parsedOverrides = parsePromptOverrides(profile.promptOverridesRaw)
  const taskOverrideLines = extractTaskOverrides(profile.promptOverridesRaw, input.task)

  const sections: string[] = [
    ...TASK_INSTRUCTIONS[input.task],
    "",
    "Clinical profile:",
    `- specialty: ${profile.specialty}`,
    `- payer: ${profile.payer}`,
    `- region: ${profile.region}`,
    `- guidelines: ${profile.guidelines.join(", ") || "none"}`,
    `- summary language: ${profile.summaryLanguage}`,
    ...stringifyContextBlock(input.runtimeContext)
  ]

  if (input.task === "compose") {
    sections.push(
      "",
      `Patient summary language must be ${profile.summaryLanguage}.`
    )
  }

  if (parsedOverrides.globalLines.length > 0 || taskOverrideLines.length > 0 || parsedOverrides.normalizedText.length > 0) {
    sections.push("", "Operator overrides:")

    for (const line of parsedOverrides.globalLines) {
      sections.push(`- ${line}`)
    }

    for (const line of taskOverrideLines) {
      sections.push(`- ${line}`)
    }

    if (parsedOverrides.globalLines.length === 0 && taskOverrideLines.length === 0) {
      sections.push(`- override_json: ${truncateForPrompt(parsedOverrides.normalizedText)}`)
    }
  }

  sections.push(
    "",
    "Guardrails:",
    "- only use evidence present in the provided input payload.",
    "- keep output deterministic and machine-parseable.",
    "- avoid placeholders like TBD/unknown unless truly missing from source."
  )

  const versionId = buildVersionId({
    task: input.task,
    profile,
    runtimeContext: input.runtimeContext,
    normalizedOverrides: parsedOverrides.normalizedText
  })

  const profileDigest = createHash("sha256")
    .update(JSON.stringify(profile))
    .digest("hex")
    .slice(0, 16)

  return {
    task: input.task,
    versionId,
    instructions: sections.join("\n"),
    metadata: {
      profileDigest,
      overridesApplied:
        parsedOverrides.applied || taskOverrideLines.length > 0
    }
  }
}
