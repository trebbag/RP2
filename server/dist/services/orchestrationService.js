import { runTask } from "../ai/aiGateway.js";
function resolveTaskType(task) {
    switch (task) {
        case "suggestions":
            return "suggestions";
        case "compliance":
            return "compliance";
        case "compose":
            return "compose";
        case "diarization":
            return "diarization";
        default:
            throw new Error(`Unsupported AI task type '${task}'. Add a task mapping before calling runJsonTask.`);
    }
}
export async function runJsonTask(input) {
    return runTask({
        taskType: resolveTaskType(input.task),
        taskName: input.task,
        instructions: input.instructions,
        payload: input.input,
        schema: input.schema,
        fallback: input.fallback,
        promptVersionId: input.promptVersionId,
        promptProfileDigest: input.promptProfileDigest,
        promptOverridesApplied: input.promptOverridesApplied,
        model: input.model,
        maxOutputTokens: input.maxOutputTokens
    });
}
//# sourceMappingURL=orchestrationService.js.map