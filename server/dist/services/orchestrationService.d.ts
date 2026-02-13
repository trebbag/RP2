import { z } from "zod";
type ProviderName = "openai" | "heuristic";
export interface OrchestrationTrace {
    traceId: string;
    task: string;
    provider: ProviderName;
    model: string;
    promptVersionId?: string;
    promptProfileDigest?: string;
    promptOverridesApplied?: boolean;
    fallback: boolean;
    startedAt: string;
    completedAt: string;
    durationMs: number;
    inputHash: string;
    outputHash: string;
    responseId?: string;
    error?: string;
}
interface RunJsonTaskInput<TSchema extends z.ZodTypeAny> {
    task: string;
    instructions: string;
    input: unknown;
    schema: TSchema;
    fallback: () => z.infer<TSchema>;
    promptVersionId?: string;
    promptProfileDigest?: string;
    promptOverridesApplied?: boolean;
    model?: string;
    maxOutputTokens?: number;
}
export interface RunJsonTaskOutput<TSchema extends z.ZodTypeAny> {
    output: z.infer<TSchema>;
    trace: OrchestrationTrace;
}
export declare function runJsonTask<TSchema extends z.ZodTypeAny>(input: RunJsonTaskInput<TSchema>): Promise<RunJsonTaskOutput<TSchema>>;
export {};
