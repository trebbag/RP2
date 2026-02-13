import { z } from "zod";
import type { OrchestrationTrace, RunTaskOutput } from "../ai/types.js";
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
export type { OrchestrationTrace };
export declare function runJsonTask<TSchema extends z.ZodTypeAny>(input: RunJsonTaskInput<TSchema>): Promise<RunTaskOutput<TSchema>>;
