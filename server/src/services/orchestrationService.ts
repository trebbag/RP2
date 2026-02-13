import { z } from "zod"
import { runTask } from "../ai/aiGateway.js"
import type { AiTaskType, OrchestrationTrace, RunTaskOutput } from "../ai/types.js"

interface RunJsonTaskInput<TSchema extends z.ZodTypeAny> {
  task: string
  instructions: string
  input: unknown
  schema: TSchema
  fallback: () => z.infer<TSchema>
  promptVersionId?: string
  promptProfileDigest?: string
  promptOverridesApplied?: boolean
  model?: string
  maxOutputTokens?: number
}

function resolveTaskType(task: string): AiTaskType {
  switch (task) {
    case "suggestions":
      return "suggestions"
    case "compliance":
      return "compliance"
    case "compose":
      return "compose"
    case "diarization":
      return "diarization"
    default:
      throw new Error(`Unsupported AI task type '${task}'. Add a task mapping before calling runJsonTask.`)
  }
}

export type { OrchestrationTrace }

export async function runJsonTask<TSchema extends z.ZodTypeAny>(
  input: RunJsonTaskInput<TSchema>
): Promise<RunTaskOutput<TSchema>> {
  return runTask({
    taskType: resolveTaskType(input.task),
    taskName: input.task,
    instructions: input.instructions,
    payload: input.input,
    schema: input.schema,
    fallback: input.fallback,
    promptVersionId: input.promptVersionId,
    promptProfileDigest: input.promptProfileDigest,
    promptOverridesApplied: input.promptOverridesApplied,
    model: input.model,
    maxOutputTokens: input.maxOutputTokens
  })
}

