import { createHash, randomUUID } from "node:crypto";
import { logger } from "../lib/logger.js";
function buildInputHash(value) {
    return createHash("sha256").update(JSON.stringify(value ?? {})).digest("hex");
}
function buildOutputHash(value) {
    return createHash("sha256").update(JSON.stringify(value ?? {})).digest("hex");
}
function fallbackTrace(task, startedAt, inputHash, output, promptMeta, error) {
    const completedAt = Date.now();
    return {
        traceId: `trace_${randomUUID()}`,
        task,
        provider: "heuristic",
        model: "heuristic-local",
        promptVersionId: promptMeta?.promptVersionId,
        promptProfileDigest: promptMeta?.promptProfileDigest,
        promptOverridesApplied: promptMeta?.promptOverridesApplied,
        fallback: true,
        startedAt: new Date(startedAt).toISOString(),
        completedAt: new Date(completedAt).toISOString(),
        durationMs: completedAt - startedAt,
        inputHash,
        outputHash: buildOutputHash(output),
        error
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
async function runOpenAiJsonTask(input) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error("OPENAI_API_KEY missing");
    }
    const model = input.model ?? process.env.OPENAI_MODEL ?? "gpt-5-mini";
    const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`
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
                            text: JSON.stringify(input.input)
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
    const text = extractOutputText(payload);
    const parsed = parseJsonPayload(text);
    const output = input.schema.parse(parsed);
    return {
        output,
        responseId: payload.id ?? undefined,
        model
    };
}
export async function runJsonTask(input) {
    const startedAt = Date.now();
    const inputHash = buildInputHash(input.input);
    const promptMeta = {
        promptVersionId: input.promptVersionId,
        promptProfileDigest: input.promptProfileDigest,
        promptOverridesApplied: input.promptOverridesApplied
    };
    if (process.env.RP2_OFFLINE_AI === "1") {
        const fallback = input.fallback();
        return {
            output: fallback,
            trace: fallbackTrace(input.task, startedAt, inputHash, fallback, promptMeta, "RP2_OFFLINE_AI=1")
        };
    }
    if (!process.env.OPENAI_API_KEY) {
        const fallback = input.fallback();
        return {
            output: fallback,
            trace: fallbackTrace(input.task, startedAt, inputHash, fallback, promptMeta, "OPENAI_API_KEY missing")
        };
    }
    try {
        const aiResult = await runOpenAiJsonTask(input);
        const completedAt = Date.now();
        const trace = {
            traceId: `trace_${randomUUID()}`,
            task: input.task,
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
        };
        return {
            output: aiResult.output,
            trace
        };
    }
    catch (error) {
        const fallback = input.fallback();
        const message = error instanceof Error ? error.message : "Unknown orchestration error";
        logger.warn("Falling back to heuristic model output", {
            task: input.task,
            reason: message
        });
        return {
            output: fallback,
            trace: fallbackTrace(input.task, startedAt, inputHash, fallback, promptMeta, message)
        };
    }
}
//# sourceMappingURL=orchestrationService.js.map