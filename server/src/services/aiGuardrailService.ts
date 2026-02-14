import { createHash } from "node:crypto"

interface SuggestionLike {
  code: string
  codeType: string
  category: "CODE" | "DIAGNOSIS" | "DIFFERENTIAL" | "PREVENTION"
  title: string
  description: string
  rationale: string
  confidence: number
  evidence: string[]
}

interface ComplianceIssueLike {
  severity: "CRITICAL" | "WARNING" | "INFO"
  title: string
  description: string
  rationale: string
  remediation: string
  evidence: string[]
  fingerprint: string
}

interface ComposeOutputLike {
  enhancedNote: string
  patientSummary: string
  traceId: string
  stages: Array<{
    id: number
    title: string
    status: "pending" | "in-progress" | "completed"
  }>
}

interface DiarizationSegmentLike {
  speaker: string
  speakerLabel?: string
  text: string
  confidence?: number
}

interface GuardrailResult<T> {
  output: T
  warnings: string[]
}

const COMPOSE_STAGE_TEMPLATE: ComposeOutputLike["stages"] = [
  { id: 1, title: "Analyzing Content", status: "completed" },
  { id: 2, title: "Enhancing Structure", status: "completed" },
  { id: 3, title: "Beautifying Language", status: "completed" },
  { id: 4, title: "Final Review", status: "completed" }
]

function hasHeading(note: string, heading: string): boolean {
  const pattern = new RegExp(`(^|\\n)\\s*${heading}\\s*:`, "i")
  return pattern.test(note)
}

function toFingerprint(title: string): string {
  return createHash("sha256").update(title.trim().toLowerCase()).digest("hex").slice(0, 24)
}

function toSafeEvidence(snippet: string): string[] {
  const trimmed = snippet.trim()
  if (!trimmed) return ["Source excerpt unavailable"]
  return [trimmed.slice(0, 140)]
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function resolveFallbackSpeaker(speakerHint?: string, preferredSpeakers?: string[]): string {
  if (speakerHint && speakerHint.trim()) return speakerHint.trim()
  if (preferredSpeakers && preferredSpeakers.length > 0) return preferredSpeakers[0]
  return "Speaker 1"
}

export function enforceSuggestionGuardrails(
  suggestions: SuggestionLike[],
  input: {
    noteContent: string
    transcriptText: string
  }
): GuardrailResult<SuggestionLike[]> {
  const warnings: string[] = []
  const deduped = new Map<string, SuggestionLike>()
  const sourceSnippet = `${input.noteContent}\n${input.transcriptText}`.trim().slice(0, 180)

  for (const suggestion of suggestions) {
    if (!suggestion.code?.trim()) continue
    const key = suggestion.code.trim().toUpperCase()

    const normalized: SuggestionLike = {
      ...suggestion,
      confidence: Math.max(0, Math.min(100, suggestion.confidence)),
      rationale: suggestion.rationale?.trim() || "Rationale was not provided by upstream model.",
      evidence: suggestion.evidence?.filter((item) => item.trim().length > 0) ?? []
    }

    if (normalized.evidence.length === 0) {
      normalized.evidence = toSafeEvidence(sourceSnippet)
      normalized.confidence = Math.min(normalized.confidence, 72)
      warnings.push(
        `Suggestion ${normalized.code} had no evidence; downgraded confidence and injected source snippet evidence.`
      )
    }

    if (!deduped.has(key)) {
      deduped.set(key, normalized)
    }
  }

  if (deduped.size === 0) {
    warnings.push("Model output contained no valid suggestions; injected baseline office-visit suggestion.")
    deduped.set("99213", {
      code: "99213",
      codeType: "CPT",
      category: "CODE",
      title: "Office visit, established patient",
      description: "Fallback coding suggestion when model output is empty.",
      rationale: "Guardrail fallback inserted due to empty/invalid model output.",
      confidence: 50,
      evidence: toSafeEvidence(sourceSnippet)
    })
  }

  return {
    output: Array.from(deduped.values()),
    warnings
  }
}

export function enforceComplianceGuardrails(
  issues: ComplianceIssueLike[],
  input: {
    noteContent: string
    selectedCodes: string[]
  }
): GuardrailResult<ComplianceIssueLike[]> {
  const warnings: string[] = []
  const normalized: ComplianceIssueLike[] = issues.map((issue) => {
    const next = {
      ...issue,
      title: issue.title.trim(),
      description: issue.description.trim(),
      remediation: issue.remediation.trim(),
      evidence: issue.evidence?.filter((item) => item.trim().length > 0) ?? []
    }

    if (next.evidence.length === 0) {
      next.evidence = toSafeEvidence(next.title)
      warnings.push(`Compliance issue '${next.title}' had no evidence; fallback evidence injected.`)
    }

    if (
      (next.severity === "CRITICAL" || next.severity === "WARNING") &&
      !/(denial|payer|claim)/i.test(next.rationale)
    ) {
      next.rationale = `${next.rationale} This gap increases payer denial risk.`
      warnings.push(`Compliance issue '${next.title}' rationale was augmented with explicit denial-risk language.`)
    }

    next.fingerprint = toFingerprint(next.title)
    return next
  })

  const noteLower = input.noteContent.toLowerCase()
  const needHpi = !noteLower.includes("history of present illness")
  const needAssessment = !noteLower.includes("assessment")
  const needPlan = !noteLower.includes("plan")
  const hasCpt = input.selectedCodes.some((code) => /^\\d{5}$/.test(code))

  const existingTitles = new Set(normalized.map((issue) => issue.title.toLowerCase()))

  if (needHpi && !Array.from(existingTitles).some((title) => title.includes("history of present illness"))) {
    warnings.push("Injected missing HPI compliance issue due to guardrail requirement.")
    normalized.push({
      severity: "CRITICAL",
      title: "History of Present Illness is missing",
      description: "HPI section is required to support coding and medical necessity.",
      rationale: "Missing HPI materially increases payer denial risk.",
      remediation: "Add a complete HPI section with onset, duration, severity, and associated symptoms.",
      evidence: ["Missing `HISTORY OF PRESENT ILLNESS` heading"],
      fingerprint: toFingerprint("History of Present Illness is missing")
    })
  }

  if (needAssessment && !Array.from(existingTitles).some((title) => title.includes("assessment"))) {
    warnings.push("Injected missing assessment compliance issue due to guardrail requirement.")
    normalized.push({
      severity: "CRITICAL",
      title: "Assessment section is missing",
      description: "Assessment drives diagnosis justification and coding specificity.",
      rationale: "Missing assessment materially increases payer denial risk.",
      remediation: "Add an assessment section with differential reasoning and diagnosis justification.",
      evidence: ["Missing `ASSESSMENT` heading"],
      fingerprint: toFingerprint("Assessment section is missing")
    })
  }

  if (needPlan && !Array.from(existingTitles).some((title) => title.includes("plan"))) {
    warnings.push("Injected missing plan compliance issue due to guardrail requirement.")
    normalized.push({
      severity: "WARNING",
      title: "Plan section is incomplete",
      description: "Plan details are needed for downstream billing and discharge instructions.",
      rationale: "Missing plan increases payer denial risk and quality concerns.",
      remediation: "Document treatment plan, ordered tests, follow-up timing, and patient instructions.",
      evidence: ["Missing `PLAN` heading"],
      fingerprint: toFingerprint("Plan section is incomplete")
    })
  }

  if (!hasCpt && !Array.from(existingTitles).some((title) => title.includes("cpt"))) {
    warnings.push("Injected missing CPT warning due to guardrail requirement.")
    normalized.push({
      severity: "WARNING",
      title: "No CPT billing code selected",
      description: "At least one CPT code should be selected before finalization.",
      rationale: "No CPT code selected increases claim rejection and denial risk.",
      remediation: "Review selected suggestions and choose an appropriate CPT office/procedure code.",
      evidence: ["Selection set includes ICD-only entries"],
      fingerprint: toFingerprint("No CPT billing code selected")
    })
  }

  const deduped = new Map<string, ComplianceIssueLike>()
  for (const issue of normalized) {
    if (!deduped.has(issue.fingerprint)) {
      deduped.set(issue.fingerprint, issue)
      continue
    }

    const existing = deduped.get(issue.fingerprint)!
    const rank = { CRITICAL: 3, WARNING: 2, INFO: 1 }
    if (rank[issue.severity] > rank[existing.severity]) {
      deduped.set(issue.fingerprint, issue)
    }
  }

  return {
    output: Array.from(deduped.values()),
    warnings
  }
}

export function enforceComposeGuardrails(output: ComposeOutputLike): GuardrailResult<ComposeOutputLike> {
  const warnings: string[] = []
  let enhancedNote = output.enhancedNote.trim()
  let patientSummary = output.patientSummary.trim()

  const requiredHeadings = ["HISTORY OF PRESENT ILLNESS", "ASSESSMENT", "PLAN"]
  for (const heading of requiredHeadings) {
    if (!hasHeading(enhancedNote, heading)) {
      warnings.push(`Enhanced note missing required heading '${heading}'; guardrail section injected.`)
      enhancedNote = `${enhancedNote}\n\n${heading}:\nSection not explicitly documented in source draft. Clinician review required.`
    }
  }

  if (!/What we discussed:/i.test(patientSummary)) {
    warnings.push("Patient summary missing 'What we discussed' section; guardrail section injected.")
    patientSummary = `${patientSummary}\n\nWhat we discussed:\n- We reviewed your symptoms, findings, and clinical plan.`
  }

  if (!/What happens next:/i.test(patientSummary)) {
    warnings.push("Patient summary missing 'What happens next' section; guardrail section injected.")
    patientSummary = `${patientSummary}\n\nWhat happens next:\n- Follow the treatment plan from this visit.\n- Contact the clinic if symptoms worsen.`
  }

  if (!/Visit Summary for\s+Patient/i.test(patientSummary)) {
    warnings.push("Patient summary title did not use de-identified header; normalized title injected.")
    patientSummary = `Visit Summary for Patient\n\n${patientSummary}`
  }

  return {
    output: {
      enhancedNote,
      patientSummary,
      traceId: output.traceId.startsWith("trace_") ? output.traceId : `trace_${output.traceId}`,
      stages:
        output.stages.length === COMPOSE_STAGE_TEMPLATE.length
          ? output.stages.map((stage, index) => ({
              id: COMPOSE_STAGE_TEMPLATE[index].id,
              title: COMPOSE_STAGE_TEMPLATE[index].title,
              status: "completed"
            }))
          : COMPOSE_STAGE_TEMPLATE
    },
    warnings
  }
}

export function enforceDiarizationGuardrails(input: {
  segments: DiarizationSegmentLike[]
  transcriptText: string
  speakerHint?: string
  preferredSpeakers?: string[]
}): GuardrailResult<DiarizationSegmentLike[]> {
  const warnings: string[] = []
  const preferred = new Set(
    (input.preferredSpeakers ?? []).map((speaker) => speaker.trim().toLowerCase()).filter(Boolean)
  )
  const fallbackSpeaker = resolveFallbackSpeaker(input.speakerHint, input.preferredSpeakers)

  const normalized = input.segments
    .map((segment) => ({
      speaker: segment.speaker?.trim() || fallbackSpeaker,
      speakerLabel: segment.speakerLabel?.trim() || undefined,
      text: segment.text?.trim() || "",
      confidence: typeof segment.confidence === "number" ? Math.max(0, Math.min(1, segment.confidence)) : undefined
    }))
    .filter((segment) => segment.text.length > 0)

  const rewritten = normalized.map((segment) => {
    if (preferred.size === 0 || preferred.has(segment.speaker.toLowerCase())) {
      return segment
    }

    warnings.push(`Speaker '${segment.speaker}' not in preferred set; reassigned to '${fallbackSpeaker}'.`)
    return {
      ...segment,
      speaker: fallbackSpeaker,
      speakerLabel: fallbackSpeaker
    }
  })

  if (rewritten.length === 0) {
    warnings.push("Diarization returned no valid segments; injected fallback transcript segment.")
    return {
      output: [
        {
          speaker: fallbackSpeaker,
          speakerLabel: fallbackSpeaker,
          text: input.transcriptText.trim() || "No transcript text available.",
          confidence: 0.6
        }
      ],
      warnings
    }
  }

  return {
    output: rewritten,
    warnings
  }
}
