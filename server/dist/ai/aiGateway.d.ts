import { z } from "zod";
import type { RunTaskInput, RunTaskOutput } from "./types.js";
export declare function runTask<TSchema extends z.ZodTypeAny>(input: RunTaskInput<TSchema>): Promise<RunTaskOutput<TSchema>>;
