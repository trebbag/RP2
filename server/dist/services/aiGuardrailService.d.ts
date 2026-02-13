interface SuggestionLike {
    code: string;
    codeType: string;
    category: "CODE" | "DIAGNOSIS" | "DIFFERENTIAL" | "PREVENTION";
    title: string;
    description: string;
    rationale: string;
    confidence: number;
    evidence: string[];
}
interface ComplianceIssueLike {
    severity: "CRITICAL" | "WARNING" | "INFO";
    title: string;
    description: string;
    rationale: string;
    remediation: string;
    evidence: string[];
    fingerprint: string;
}
interface ComposeOutputLike {
    enhancedNote: string;
    patientSummary: string;
    traceId: string;
    stages: Array<{
        id: number;
        title: string;
        status: "pending" | "in-progress" | "completed";
    }>;
}
interface DiarizationSegmentLike {
    speaker: string;
    speakerLabel?: string;
    text: string;
    confidence?: number;
}
interface GuardrailResult<T> {
    output: T;
    warnings: string[];
}
export declare function enforceSuggestionGuardrails(suggestions: SuggestionLike[], input: {
    noteContent: string;
    transcriptText: string;
}): GuardrailResult<SuggestionLike[]>;
export declare function enforceComplianceGuardrails(issues: ComplianceIssueLike[], input: {
    noteContent: string;
    selectedCodes: string[];
}): GuardrailResult<ComplianceIssueLike[]>;
export declare function enforceComposeGuardrails(output: ComposeOutputLike, input: {
    patientName: string;
}): GuardrailResult<ComposeOutputLike>;
export declare function enforceDiarizationGuardrails(input: {
    segments: DiarizationSegmentLike[];
    transcriptText: string;
    speakerHint?: string;
    preferredSpeakers?: string[];
}): GuardrailResult<DiarizationSegmentLike[]>;
export {};
