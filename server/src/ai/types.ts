import type { z } from "zod"

export type AiTaskType = "suggestions" | "compliance" | "compose" | "diarization"
export type ProviderName = "openai" | "heuristic"

export interface OrchestrationTrace {
  traceId: string
  task: string
  provider: ProviderName
  model: string
  promptVersionId?: string
  promptProfileDigest?: string
  promptOverridesApplied?: boolean
  fallback: boolean
  startedAt: string
  completedAt: string
  durationMs: number
  inputHash: string
  outputHash: string
  responseId?: string
  error?: string
}

export interface PhiPatternCount {
  type: "email" | "phone" | "ssn"
  count: number
}

export interface PhiViolationDetails {
  reason: "forbidden_keys" | "phi_patterns"
  taskType?: AiTaskType
  forbiddenKeyPaths?: string[]
  patternCounts?: PhiPatternCount[]
}

export class PhiViolationError extends Error {
  readonly details: PhiViolationDetails

  constructor(message: string, details: PhiViolationDetails) {
    super(message)
    this.name = "PhiViolationError"
    this.details = details
  }
}

export interface RunTaskInput<TSchema extends z.ZodTypeAny> {
  taskType: AiTaskType
  taskName?: string
  instructions: string
  payload: unknown
  schema: TSchema
  fallback: () => z.infer<TSchema>
  promptVersionId?: string
  promptProfileDigest?: string
  promptOverridesApplied?: boolean
  model?: string
  maxOutputTokens?: number
  traceId?: string
}

export interface RunTaskOutput<TSchema extends z.ZodTypeAny> {
  output: z.infer<TSchema>
  trace: OrchestrationTrace
}

