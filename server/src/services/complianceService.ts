import { createHash } from "node:crypto"
import { complianceIssueListSchema } from "./schemas.js"
import { runJsonTask } from "./orchestrationService.js"
import { buildPromptBundle, type PromptProfile } from "./promptBuilderService.js"
import { enforceComplianceGuardrails } from "./aiGuardrailService.js"
import { deidentifyEncounterContext } from "../ai/deidentify.js"

interface ComplianceInput {
  noteContent: string
  selectedCodes: string[]
}

function fingerprint(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 24)
}

export function generateComplianceIssues(input: ComplianceInput) {
  const note = input.noteContent
  const noteLower = note.toLowerCase()
  const issues: Array<{
    severity: "CRITICAL" | "WARNING" | "INFO"
    title: string
    description: string
    rationale: string
    remediation: string
    evidence: string[]
    fingerprint: string
  }> = []

  if (!noteLower.includes("history of present illness")) {
    const title = "History of Present Illness is missing"
    issues.push({
      severity: "CRITICAL",
      title,
      description: "HPI section is required to support coding and medical necessity.",
      rationale: "Payer review frequently denies visits without an explicit HPI narrative.",
      remediation: "Add a complete HPI section with onset, duration, severity, and associated symptoms.",
      evidence: ["Missing `HISTORY OF PRESENT ILLNESS` heading"],
      fingerprint: fingerprint(title)
    })
  }

  if (!noteLower.includes("assessment")) {
    const title = "Assessment section is missing"
    issues.push({
      severity: "CRITICAL",
      title,
      description: "Assessment drives diagnosis justification and coding specificity.",
      rationale: "Without a clear assessment, diagnosis selection is difficult to defend.",
      remediation: "Add an assessment section with differential reasoning and final diagnosis rationale.",
      evidence: ["Missing `ASSESSMENT` heading"],
      fingerprint: fingerprint(title)
    })
  }

  if (!noteLower.includes("plan")) {
    const title = "Plan section is incomplete"
    issues.push({
      severity: "WARNING",
      title,
      description: "Plan details are needed for downstream billing and discharge instructions.",
      rationale: "Lack of actionable follow-up plan increases denial risk and quality concerns.",
      remediation: "Document treatment plan, tests ordered, follow-up timing, and patient instructions.",
      evidence: ["Missing `PLAN` heading"],
      fingerprint: fingerprint(title)
    })
  }

  const hasCpt = input.selectedCodes.some((code) => /^\d{5}$/.test(code))
  if (!hasCpt) {
    const title = "No CPT billing code selected"
    issues.push({
      severity: "WARNING",
      title,
      description: "At least one CPT code should be selected before finalization.",
      rationale: "Finalization without procedure/visit CPT can block claim generation.",
      remediation: "Review selected suggestions and choose an appropriate CPT office/procedure code.",
      evidence: ["Selection set includes ICD-only entries"],
      fingerprint: fingerprint(title)
    })
  }

  if (note.trim().length < 280) {
    const title = "Note appears too short for moderate complexity encounter"
    issues.push({
      severity: "INFO",
      title,
      description: "Short notes may under-document complexity and patient counseling.",
      rationale: "Documentation density should match billed complexity for denial defense.",
      remediation: "Expand medical decision making and patient education details.",
      evidence: [`Note length: ${note.trim().length} chars`],
      fingerprint: fingerprint(title)
    })
  }

  return complianceIssueListSchema.parse(issues)
}

export async function generateComplianceIssuesOrchestrated(input: ComplianceInput, promptProfile?: PromptProfile) {
  const deidentified = deidentifyEncounterContext({
    noteContent: input.noteContent,
    selectedCodes: input.selectedCodes
  })
  const aiPayload = {
    noteText: deidentified.noteText,
    selectedCodes: deidentified.selectedCodes
  }

  const prompt = buildPromptBundle({
    task: "compliance",
    profile: promptProfile
  })
  const fallback = () =>
    generateComplianceIssues({
      noteContent: deidentified.noteText,
      selectedCodes: deidentified.selectedCodes
    })
  const result = await runJsonTask({
    task: "compliance",
    instructions: prompt.instructions,
    input: aiPayload,
    schema: complianceIssueListSchema,
    fallback,
    promptVersionId: prompt.versionId,
    promptProfileDigest: prompt.metadata.profileDigest,
    promptOverridesApplied: prompt.metadata.overridesApplied
  })
  const guarded = enforceComplianceGuardrails(result.output, {
    noteContent: deidentified.noteText,
    selectedCodes: deidentified.selectedCodes
  })
  return {
    ...result,
    output: complianceIssueListSchema.parse(guarded.output),
    prompt,
    guardrailWarnings: guarded.warnings
  }
}
