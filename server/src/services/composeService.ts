import { createHash } from "node:crypto"
import { composeOutputSchema } from "./schemas.js"
import { runJsonTask } from "./orchestrationService.js"
import { buildPromptBundle, type PromptProfile } from "./promptBuilderService.js"
import { enforceComposeGuardrails } from "./aiGuardrailService.js"
import { deidentifyEncounterContext } from "../ai/deidentify.js"

export const COMPOSE_STAGES = [
  { id: 1, title: "Analyzing Content", status: "completed" as const },
  { id: 2, title: "Enhancing Structure", status: "completed" as const },
  { id: 3, title: "Beautifying Language", status: "completed" as const },
  { id: 4, title: "Final Review", status: "completed" as const }
]

export interface ComposeInput {
  noteContent: string
}

function toSentenceCase(input: string): string {
  return input
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      if (line.endsWith(":")) return line.toUpperCase()
      const normalized = line.charAt(0).toUpperCase() + line.slice(1)
      return normalized.endsWith(".") ? normalized : `${normalized}.`
    })
    .join("\n")
}

export function composeNote(input: ComposeInput) {
  const enhancedNote = toSentenceCase(input.noteContent)
  const summary = [
    "Visit Summary for Patient",
    "",
    "What we discussed:",
    "- Your symptoms and current concerns were reviewed in detail.",
    "- We documented key findings and your treatment plan.",
    "",
    "What happens next:",
    "- Follow the care plan and medication guidance from today’s note.",
    "- Contact the clinic for worsening symptoms or urgent concerns.",
    "- Schedule your recommended follow-up appointment."
  ].join("\n")

  const traceId = `trace_${createHash("sha256")
    .update(`${input.noteContent}|${Date.now()}`)
    .digest("hex")
    .slice(0, 16)}`

  return composeOutputSchema.parse({
    enhancedNote,
    patientSummary: summary,
    traceId,
    stages: COMPOSE_STAGES
  })
}

export async function composeNoteOrchestrated(input: ComposeInput, promptProfile?: PromptProfile) {
  const deidentified = deidentifyEncounterContext({
    noteContent: input.noteContent
  })
  const aiPayload: Record<string, unknown> = {
    noteText: deidentified.noteText
  }

  const prompt = buildPromptBundle({
    task: "compose",
    profile: promptProfile
  })
  const fallback = () =>
    composeNote({
      noteContent: deidentified.noteText
    })
  const result = await runJsonTask({
    task: "compose",
    instructions: prompt.instructions,
    input: aiPayload,
    schema: composeOutputSchema,
    fallback,
    promptVersionId: prompt.versionId,
    promptProfileDigest: prompt.metadata.profileDigest,
    promptOverridesApplied: prompt.metadata.overridesApplied,
    maxOutputTokens: 2400
  })
  const guarded = enforceComposeGuardrails(result.output)
  return {
    ...result,
    output: composeOutputSchema.parse(guarded.output),
    prompt,
    guardrailWarnings: guarded.warnings
  }
}
