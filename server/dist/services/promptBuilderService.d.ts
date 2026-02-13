export type AiPromptTask = "suggestions" | "compliance" | "compose" | "diarization";
export interface PromptProfile {
    specialty: string;
    payer: string;
    region: string;
    guidelines: string[];
    summaryLanguage: string;
    promptOverridesRaw: string;
}
export interface PromptBundle {
    task: AiPromptTask;
    versionId: string;
    instructions: string;
    metadata: {
        profileDigest: string;
        overridesApplied: boolean;
    };
}
interface PromptBuildInput {
    task: AiPromptTask;
    profile?: PromptProfile;
    runtimeContext?: Record<string, unknown>;
}
export declare function loadPromptProfileForUser(userId?: string): Promise<PromptProfile>;
export declare function buildPromptBundle(input: PromptBuildInput): PromptBundle;
export {};
