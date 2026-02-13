import { type PromptProfile } from "./promptBuilderService.js";
export declare const COMPOSE_STAGES: {
    id: number;
    title: string;
    status: "completed";
}[];
export interface ComposeInput {
    noteContent: string;
    patientName: string;
}
export declare function composeNote(input: ComposeInput): {
    enhancedNote: string;
    patientSummary: string;
    traceId: string;
    stages: {
        id: number;
        title: string;
        status: "pending" | "in-progress" | "completed";
    }[];
};
export declare function composeNoteOrchestrated(input: ComposeInput, promptProfile?: PromptProfile): Promise<{
    output: {
        enhancedNote: string;
        patientSummary: string;
        traceId: string;
        stages: {
            id: number;
            title: string;
            status: "pending" | "in-progress" | "completed";
        }[];
    };
    prompt: import("./promptBuilderService.js").PromptBundle;
    guardrailWarnings: string[];
    trace: import("./orchestrationService.js").OrchestrationTrace;
}>;
