import { type PromptProfile } from "./promptBuilderService.js";
interface SuggestionInput {
    noteContent: string;
    transcriptText: string;
    chartContext?: Record<string, unknown> | null;
}
interface RefreshPolicyInput {
    noteDeltaChars: number;
    transcriptDeltaChars: number;
    secondsSinceLastRefresh: number;
}
export declare function shouldRefreshSuggestions(input: RefreshPolicyInput): boolean;
export declare function buildSuggestionInputHash(input: SuggestionInput): string;
export declare function generateSuggestions(input: SuggestionInput): {
    code: string;
    codeType: string;
    category: "CODE" | "DIAGNOSIS" | "DIFFERENTIAL" | "PREVENTION";
    title: string;
    description: string;
    rationale: string;
    confidence: number;
    evidence: string[];
}[];
export declare function generateSuggestionsOrchestrated(input: SuggestionInput, promptProfile?: PromptProfile): Promise<{
    output: {
        code: string;
        codeType: string;
        category: "CODE" | "DIAGNOSIS" | "DIFFERENTIAL" | "PREVENTION";
        title: string;
        description: string;
        rationale: string;
        confidence: number;
        evidence: string[];
    }[];
    prompt: import("./promptBuilderService.js").PromptBundle;
    guardrailWarnings: string[];
    trace: import("./orchestrationService.js").OrchestrationTrace;
}>;
export {};
