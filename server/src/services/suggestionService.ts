import crypto from "node:crypto"
import { suggestionListSchema } from "./schemas.js"
import { runJsonTask } from "./orchestrationService.js"
import { buildPromptBundle, type PromptProfile } from "./promptBuilderService.js"
import { enforceSuggestionGuardrails } from "./aiGuardrailService.js"

interface SuggestionInput {
  noteContent: string
  transcriptText: string
  chartContext?: Record<string, unknown> | null
}

interface RefreshPolicyInput {
  noteDeltaChars: number
  transcriptDeltaChars: number
  secondsSinceLastRefresh: number
}

interface Candidate {
  code: string
  codeType: string
  category: "CODE" | "DIAGNOSIS" | "DIFFERENTIAL" | "PREVENTION"
  title: string
  description: string
  rationale: string
  confidence: number
  evidence: string[]
}

export function shouldRefreshSuggestions(input: RefreshPolicyInput): boolean {
  if (input.noteDeltaChars >= 120) return true
  if (input.transcriptDeltaChars >= 250) return true
  return input.secondsSinceLastRefresh >= 90
}

export function buildSuggestionInputHash(input: SuggestionInput): string {
  const hash = crypto.createHash("sha256")
  hash.update(input.noteContent)
  hash.update("|")
  hash.update(input.transcriptText)
  hash.update("|")
  hash.update(JSON.stringify(input.chartContext ?? {}))
  return hash.digest("hex")
}

export function generateSuggestions(input: SuggestionInput) {
  const text = `${input.noteContent}\n${input.transcriptText}`.toLowerCase()
  const candidates: Candidate[] = []

  if (text.includes("chest pain")) {
    candidates.push({
      code: "I25.10",
      codeType: "ICD-10",
      category: "DIAGNOSIS",
      title: "Atherosclerotic heart disease of native coronary artery without angina pectoris",
      description: "Cardiac risk diagnosis associated with chest pain presentation.",
      rationale: "Chest pain and cardiovascular risk profile should be represented in coding.",
      confidence: 91,
      evidence: ["chest pain", "cardiac"]
    })
    candidates.push({
      code: "93000",
      codeType: "CPT",
      category: "CODE",
      title: "Electrocardiogram, routine ECG with interpretation",
      description: "Captures EKG order and interpretation workflow.",
      rationale: "Note references cardiac evaluation with EKG.",
      confidence: 86,
      evidence: ["EKG", "electrocardiogram", "cardiac evaluation"]
    })
  }

  if (text.includes("smok")) {
    candidates.push({
      code: "F17.210",
      codeType: "ICD-10",
      category: "DIAGNOSIS",
      title: "Nicotine dependence, cigarettes, uncomplicated",
      description: "Current tobacco dependence with counseling relevance.",
      rationale: "Smoking status documented and clinically relevant to treatment plan.",
      confidence: 88,
      evidence: ["smoking", "cigarettes", "cessation counseling"]
    })
  }

  if (text.includes("cough")) {
    candidates.push({
      code: "J06.9",
      codeType: "ICD-10",
      category: "DIAGNOSIS",
      title: "Acute upper respiratory infection, unspecified",
      description: "Likely acute URI based on cough-focused encounter.",
      rationale: "Persistent cough with URI symptom profile indicates an infectious differential.",
      confidence: 84,
      evidence: ["cough", "dry cough", "respiratory"]
    })
  }

  if (typeof input.chartContext?.["medications"] !== "undefined") {
    candidates.push({
      code: "Z79.899",
      codeType: "ICD-10",
      category: "PREVENTION",
      title: "Other long term (current) drug therapy",
      description: "Chart indicates active medication management.",
      rationale: "Medication list in chart context supports long-term therapy coding.",
      confidence: 73,
      evidence: ["medications"]
    })
  }

  if (!text.includes("plan:")) {
    candidates.push({
      code: "DOCUMENT-PLAN",
      codeType: "WORKFLOW",
      category: "DIFFERENTIAL",
      title: "Document treatment plan",
      description: "Complete plan section to support coding and compliance.",
      rationale: "Missing plan section weakens coding confidence and denial defense.",
      confidence: 69,
      evidence: ["No explicit PLAN section found"]
    })
  }

  const deduped = Array.from(new Map(candidates.map((item) => [item.code, item])).values())
  if (deduped.length === 0) {
    deduped.push({
      code: "99213",
      codeType: "CPT",
      category: "CODE",
      title: "Office visit, established patient",
      description: "Fallback coding suggestion when documentation is limited.",
      rationale: "Baseline office visit code while additional details are gathered.",
      confidence: 55,
      evidence: ["insufficient context"]
    })
  }

  return suggestionListSchema.parse(deduped)
}

export async function generateSuggestionsOrchestrated(input: SuggestionInput, promptProfile?: PromptProfile) {
  const prompt = buildPromptBundle({
    task: "suggestions",
    profile: promptProfile
  })
  const fallback = () => generateSuggestions(input)
  const result = await runJsonTask({
    task: "suggestions",
    instructions: prompt.instructions,
    input,
    schema: suggestionListSchema,
    fallback,
    promptVersionId: prompt.versionId,
    promptProfileDigest: prompt.metadata.profileDigest,
    promptOverridesApplied: prompt.metadata.overridesApplied
  })
  const guarded = enforceSuggestionGuardrails(result.output, {
    noteContent: input.noteContent,
    transcriptText: input.transcriptText
  })
  return {
    ...result,
    output: suggestionListSchema.parse(guarded.output),
    prompt,
    guardrailWarnings: guarded.warnings
  }
}
