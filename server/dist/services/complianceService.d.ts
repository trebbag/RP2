import { type PromptProfile } from "./promptBuilderService.js";
interface ComplianceInput {
    noteContent: string;
    selectedCodes: string[];
}
export declare function generateComplianceIssues(input: ComplianceInput): {
    severity: "INFO" | "CRITICAL" | "WARNING";
    title: string;
    description: string;
    rationale: string;
    remediation: string;
    evidence: string[];
    fingerprint: string;
}[];
export declare function generateComplianceIssuesOrchestrated(input: ComplianceInput, promptProfile?: PromptProfile): Promise<{
    output: {
        severity: "INFO" | "CRITICAL" | "WARNING";
        title: string;
        description: string;
        rationale: string;
        remediation: string;
        evidence: string[];
        fingerprint: string;
    }[];
    prompt: import("./promptBuilderService.js").PromptBundle;
    guardrailWarnings: string[];
    trace: import("./orchestrationService.js").OrchestrationTrace;
}>;
export {};
