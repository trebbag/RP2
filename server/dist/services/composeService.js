import { createHash } from "node:crypto";
import { composeOutputSchema } from "./schemas.js";
import { runJsonTask } from "./orchestrationService.js";
import { buildPromptBundle } from "./promptBuilderService.js";
import { enforceComposeGuardrails } from "./aiGuardrailService.js";
export const COMPOSE_STAGES = [
    { id: 1, title: "Analyzing Content", status: "completed" },
    { id: 2, title: "Enhancing Structure", status: "completed" },
    { id: 3, title: "Beautifying Language", status: "completed" },
    { id: 4, title: "Final Review", status: "completed" }
];
function toSentenceCase(input) {
    return input
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
        if (line.endsWith(":"))
            return line.toUpperCase();
        const normalized = line.charAt(0).toUpperCase() + line.slice(1);
        return normalized.endsWith(".") ? normalized : `${normalized}.`;
    })
        .join("\n");
}
export function composeNote(input) {
    const enhancedNote = toSentenceCase(input.noteContent);
    const summary = [
        `Visit Summary for ${input.patientName || "Patient"}`,
        "",
        "What we discussed:",
        "- Your symptoms and current concerns were reviewed in detail.",
        "- We documented key findings and your treatment plan.",
        "",
        "What happens next:",
        "- Follow the care plan and medication guidance from today’s note.",
        "- Contact the clinic for worsening symptoms or urgent concerns.",
        "- Schedule your recommended follow-up appointment."
    ].join("\n");
    const traceId = `trace_${createHash("sha256")
        .update(`${input.patientName}|${input.noteContent}|${Date.now()}`)
        .digest("hex")
        .slice(0, 16)}`;
    return composeOutputSchema.parse({
        enhancedNote,
        patientSummary: summary,
        traceId,
        stages: COMPOSE_STAGES
    });
}
export async function composeNoteOrchestrated(input, promptProfile) {
    const prompt = buildPromptBundle({
        task: "compose",
        profile: promptProfile,
        runtimeContext: {
            patientName: input.patientName
        }
    });
    const fallback = () => composeNote(input);
    const result = await runJsonTask({
        task: "compose",
        instructions: prompt.instructions,
        input,
        schema: composeOutputSchema,
        fallback,
        promptVersionId: prompt.versionId,
        promptProfileDigest: prompt.metadata.profileDigest,
        promptOverridesApplied: prompt.metadata.overridesApplied,
        maxOutputTokens: 2400
    });
    const guarded = enforceComposeGuardrails(result.output, {
        patientName: input.patientName
    });
    return {
        ...result,
        output: composeOutputSchema.parse(guarded.output),
        prompt,
        guardrailWarnings: guarded.warnings
    };
}
//# sourceMappingURL=composeService.js.map