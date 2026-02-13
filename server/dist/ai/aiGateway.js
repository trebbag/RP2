import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { deidentifyText } from "./deidentify.js";
import { assertNoPhiPayload } from "./phiGuards.js";
import { PhiViolationError } from "./types.js";
const PAYLOAD_SCHEMAS = {
    suggestions: z
        .object({
        noteText: z.string(),
        transcriptText: z.string(),
        chartFacts: z.record(z.string(), z.unknown()).nullable().optional()
    })
        .strict(),
    compliance: z
        .object({
        noteText: z.string(),
        selectedCodes: z.array(z.string())
    })
        .strict(),
    compose: z
        .object({
        noteText: z.string()
    })
        .strict(),
    diarization: z
        .object({
        transcriptText: z.string(),
        speakerHint: z.string().optional(),
        speakerHints: z.array(z.string()).optional()
    })
        .strict()
};
function buildInputHash(value) {
    return createHash("sha256").update(JSON.stringify(value ?? {})).digest("hex");
}
function buildOutputHash(value) {
    return createHash("sha256").update(JSON.stringify(value ?? {})).digest("hex");
}
function toSafeErrorMessage(error) {
    const raw = error instanceof Error ? error.message : "Unknown AI gateway error";
    const redacted = deidentifyText(raw).text;
    return redacted.slice(0, 260);
}
function buildPayloadStats(value) {
    let objectCount = 0;
    let arrayCount = 0;
    let stringCount = 0;
    let stringChars = 0;
    const visited = new WeakSet();
    const walk = (node) => {
        if (typeof node === "string") {
            stringCount += 1;
            stringChars += node.length;
            return;
        }
        if (!node || typeof node !== "object")
            return;
        if (visited.has(node))
            return;
        visited.add(node);
        if (Array.isArray(node)) {
            arrayCount += 1;
            node.forEach((item) => walk(item));
            return;
        }
        objectCount += 1;
        Object.values(node).forEach((item) => walk(item));
    };
    walk(value);
    return {
        objectCount,
        arrayCount,
        stringCount,
        stringChars
    };
}
function fallbackTrace(params) {
    const completedAt = Date.now();
    return {
        traceId: params.traceId ?? `trace_${randomUUID()}`,
        task: params.taskName,
        provider: "heuristic",
        model: "heuristic-local",
        promptVersionId: params.promptVersionId,
        promptProfileDigest: params.promptProfileDigest,
        promptOverridesApplied: params.promptOverridesApplied,
        fallback: true,
        startedAt: new Date(params.startedAt).toISOString(),
        completedAt: new Date(completedAt).toISOString(),
        durationMs: completedAt - params.startedAt,
        inputHash: params.inputHash,
        outputHash: buildOutputHash(params.output),
        error: params.error
    };
}
function extractOutputText(payload) {
    if (typeof payload.output_text === "string" && payload.output_text.trim().length > 0) {
        return payload.output_text;
    }
    const chunks = [];
    for (const item of payload.output ?? []) {
        for (const content of item.content ?? []) {
            if (typeof content.text === "string" && content.text.trim().length > 0) {
                chunks.push(content.text);
            }
        }
    }
    return chunks.join("\n").trim();
}
function parseJsonPayload(text) {
    const trimmed = text.trim();
    if (trimmed.length === 0)
        throw new Error("Model returned empty output");
    try {
        return JSON.parse(trimmed);
    }
    catch {
        const startObject = trimmed.indexOf("{");
        const endObject = trimmed.lastIndexOf("}");
        if (startObject >= 0 && endObject > startObject) {
            return JSON.parse(trimmed.slice(startObject, endObject + 1));
        }
        const startArray = trimmed.indexOf("[");
        const endArray = trimmed.lastIndexOf("]");
        if (startArray >= 0 && endArray > startArray) {
            return JSON.parse(trimmed.slice(startArray, endArray + 1));
        }
        throw new Error("Failed to parse model JSON output");
    }
}
async function callOpenAiJsonTask(input) {
    if (!env.OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY missing");
    }
    const model = input.model ?? env.OPENAI_MODEL ?? "gpt-5-mini";
    const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
            model,
            input: [
                {
                    role: "system",
                    content: [
                        {
                            type: "input_text",
                            text: `${input.instructions}\nReturn valid JSON only.`
                        }
                    ]
                },
                {
                    role: "user",
                    content: [
                        {
                            type: "input_text",
                            text: JSON.stringify(input.payload)
                        }
                    ]
                }
            ],
            max_output_tokens: input.maxOutputTokens ?? 1800
        })
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`OpenAI responses error ${response.status}: ${text.slice(0, 280)}`);
    }
    const payload = (await response.json());
    const outputText = extractOutputText(payload);
    const parsed = parseJsonPayload(outputText);
    return {
        output: input.schema.parse(parsed),
        responseId: payload.id,
        model
    };
}
export async function runTask(input) {
    const taskName = input.taskName ?? input.taskType;
    const payloadSchema = PAYLOAD_SCHEMAS[input.taskType];
    const startedAt = Date.now();
    try {
        assertNoPhiPayload(input.payload, input.taskType);
    }
    catch (error) {
        if (error instanceof PhiViolationError) {
            logger.warn("ai_gateway.phi_violation", {
                taskType: input.taskType,
                taskName,
                traceId: input.traceId ?? null,
                details: error.details
            });
        }
        throw error;
    }
    const validatedPayload = payloadSchema.parse(input.payload);
    try {
        assertNoPhiPayload(validatedPayload, input.taskType);
    }
    catch (error) {
        if (error instanceof PhiViolationError) {
            logger.warn("ai_gateway.phi_violation", {
                taskType: input.taskType,
                taskName,
                traceId: input.traceId ?? null,
                details: error.details
            });
        }
        throw error;
    }
    const inputHash = buildInputHash(validatedPayload);
    logger.info("ai_gateway.task_received", {
        taskType: input.taskType,
        taskName,
        traceId: input.traceId ?? null,
        payloadStats: buildPayloadStats(validatedPayload)
    });
    if (process.env.RP2_OFFLINE_AI === "1") {
        const fallbackOutput = input.fallback();
        return {
            output: fallbackOutput,
            trace: fallbackTrace({
                taskName,
                startedAt,
                inputHash,
                output: fallbackOutput,
                promptVersionId: input.promptVersionId,
                promptProfileDigest: input.promptProfileDigest,
                promptOverridesApplied: input.promptOverridesApplied,
                traceId: input.traceId,
                error: "RP2_OFFLINE_AI=1"
            })
        };
    }
    if (!env.OPENAI_API_KEY) {
        const fallbackOutput = input.fallback();
        return {
            output: fallbackOutput,
            trace: fallbackTrace({
                taskName,
                startedAt,
                inputHash,
                output: fallbackOutput,
                promptVersionId: input.promptVersionId,
                promptProfileDigest: input.promptProfileDigest,
                promptOverridesApplied: input.promptOverridesApplied,
                traceId: input.traceId,
                error: "OPENAI_API_KEY missing"
            })
        };
    }
    try {
        const aiResult = await callOpenAiJsonTask({
            payload: validatedPayload,
            instructions: input.instructions,
            schema: input.schema,
            model: input.model,
            maxOutputTokens: input.maxOutputTokens
        });
        const completedAt = Date.now();
        return {
            output: aiResult.output,
            trace: {
                traceId: input.traceId ?? `trace_${randomUUID()}`,
                task: taskName,
                provider: "openai",
                model: aiResult.model,
                promptVersionId: input.promptVersionId,
                promptProfileDigest: input.promptProfileDigest,
                promptOverridesApplied: input.promptOverridesApplied,
                fallback: false,
                startedAt: new Date(startedAt).toISOString(),
                completedAt: new Date(completedAt).toISOString(),
                durationMs: completedAt - startedAt,
                inputHash,
                outputHash: buildOutputHash(aiResult.output),
                responseId: aiResult.responseId
            }
        };
    }
    catch (error) {
        if (error instanceof PhiViolationError) {
            logger.warn("ai_gateway.phi_violation", {
                taskType: input.taskType,
                taskName,
                traceId: input.traceId ?? null,
                details: error.details
            });
            throw error;
        }
        const safeReason = toSafeErrorMessage(error);
        logger.warn("ai_gateway.fallback", {
            taskType: input.taskType,
            taskName,
            traceId: input.traceId ?? null,
            reason: safeReason
        });
        const fallbackOutput = input.fallback();
        return {
            output: fallbackOutput,
            trace: fallbackTrace({
                taskName,
                startedAt,
                inputHash,
                output: fallbackOutput,
                promptVersionId: input.promptVersionId,
                promptProfileDigest: input.promptProfileDigest,
                promptOverridesApplied: input.promptOverridesApplied,
                traceId: input.traceId,
                error: safeReason
            })
        };
    }
}
//# sourceMappingURL=aiGateway.js.map