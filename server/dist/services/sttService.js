import { z } from "zod";
import { env } from "../config/env.js";
import { runJsonTask } from "./orchestrationService.js";
import { buildPromptBundle } from "./promptBuilderService.js";
import { enforceDiarizationGuardrails } from "./aiGuardrailService.js";
import { deidentifyText } from "../ai/deidentify.js";
import { logger } from "../lib/logger.js";
import { getTranscriptionProvider } from "./transcription/providerFactory.js";
const diarizationSchema = z.object({
    segments: z
        .array(z.object({
        speaker: z.string().min(1),
        speakerLabel: z.string().optional(),
        text: z.string().min(1),
        confidence: z.number().min(0).max(1).optional()
    }))
        .min(1)
});
function normalizeSpeaker(value) {
    if (!value)
        return "Speaker 1";
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : "Speaker 1";
}
function naiveDiarization(text, speakerHint) {
    const cleaned = text.trim();
    if (!cleaned)
        return [];
    const chunks = cleaned
        .split(/(?<=[.!?])\s+/)
        .map((chunk) => chunk.trim())
        .filter(Boolean);
    if (chunks.length === 0) {
        return [
            {
                speaker: normalizeSpeaker(speakerHint),
                speakerLabel: normalizeSpeaker(speakerHint),
                text: cleaned,
                confidence: 0.72
            }
        ];
    }
    return chunks.map((chunk) => ({
        speaker: normalizeSpeaker(speakerHint),
        speakerLabel: normalizeSpeaker(speakerHint),
        text: chunk,
        confidence: 0.72
    }));
}
function approximateDurationMs(text) {
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(2500, words * 420);
}
function allocateTimings(segments, options) {
    const totalChars = segments.reduce((sum, segment) => sum + Math.max(segment.text.length, 1), 0);
    let cursor = options.baseStartMs;
    return segments.map((segment, index) => {
        const weight = Math.max(segment.text.length, 1) / Math.max(totalChars, 1);
        const rawDuration = Math.round(options.durationMs * weight);
        const minDuration = 600;
        const remaining = options.baseStartMs + options.durationMs - cursor;
        const duration = index === segments.length - 1 ? Math.max(remaining, minDuration) : Math.max(rawDuration, minDuration);
        const startMs = cursor;
        const endMs = startMs + duration;
        cursor = endMs;
        return {
            speaker: normalizeSpeaker(segment.speaker),
            speakerLabel: segment.speakerLabel,
            text: segment.text.trim(),
            startMs,
            endMs,
            confidence: segment.confidence
        };
    });
}
async function diarizeText(input) {
    const hints = input.speakerHints?.filter(Boolean) ?? env.DIARIZATION_SPEAKERS.split(",").map((item) => item.trim()).filter(Boolean);
    const prompt = buildPromptBundle({
        task: "diarization",
        profile: input.promptProfile,
        runtimeContext: {
            speakerHint: input.speakerHint ?? null,
            preferredSpeakers: hints
        }
    });
    const deidentifiedTranscript = deidentifyText(input.transcriptText);
    const result = await runJsonTask({
        task: "diarization",
        instructions: `${prompt.instructions}\nPreferred speaker labels: ${hints.join(", ") || "Doctor, Patient"}.`,
        input: {
            transcriptText: deidentifiedTranscript.text,
            speakerHint: input.speakerHint,
            speakerHints: hints
        },
        schema: diarizationSchema,
        fallback: () => ({
            segments: naiveDiarization(deidentifiedTranscript.text, input.speakerHint)
        }),
        promptVersionId: prompt.versionId,
        promptProfileDigest: prompt.metadata.profileDigest,
        promptOverridesApplied: prompt.metadata.overridesApplied,
        maxOutputTokens: 1800
    });
    return {
        ...result,
        prompt
    };
}
export async function diarizeTranscriptText(input) {
    const diarized = await diarizeText(input);
    return {
        segments: diarized.output.segments,
        trace: diarized.trace,
        prompt: diarized.prompt
    };
}
export async function transcribeAndDiarizeAudio(input) {
    const warnings = [];
    const provider = getTranscriptionProvider();
    let transcriptTextPhi;
    try {
        const transcription = await provider.transcribeAudioChunk({
            filePath: input.filePath,
            mimeType: input.mimeType
        });
        transcriptTextPhi = transcription.transcriptText;
        warnings.push(...(transcription.warnings ?? []));
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unknown transcription provider error";
        warnings.push(`Transcription failed: ${message}`);
        logger.warn("stt.transcription_provider_error", {
            provider: provider.name,
            mimeType: input.mimeType,
            filePath: input.filePath
        });
        return {
            transcriptText: "",
            segments: [],
            provider: "fallback",
            warnings,
            diarizationTrace: undefined
        };
    }
    const transcriptText = transcriptTextPhi.trim();
    if (!transcriptText) {
        warnings.push("No transcript text returned for audio chunk.");
        return {
            transcriptText: "",
            segments: [],
            provider: provider.name,
            warnings,
            diarizationTrace: undefined
        };
    }
    const diarized = await diarizeText({
        transcriptText,
        speakerHint: input.speakerHint,
        speakerHints: input.speakerHints,
        promptProfile: input.promptProfile
    });
    const guarded = enforceDiarizationGuardrails({
        segments: diarized.output.segments,
        transcriptText,
        speakerHint: input.speakerHint,
        preferredSpeakers: input.speakerHints
    });
    if (diarized.trace.fallback) {
        if (diarized.trace.error)
            warnings.push(diarized.trace.error);
    }
    warnings.push(...guarded.warnings);
    const inferredStartFromClock = typeof input.sessionElapsedMs === "number"
        ? Math.max(0, input.sessionElapsedMs - (input.chunkDurationMs ?? 0))
        : 0;
    const baseStartMs = Math.max(0, input.lastKnownEndMs, inferredStartFromClock);
    const durationFromSegments = 0;
    const durationMs = input.chunkDurationMs ??
        (durationFromSegments > 0 ? durationFromSegments : approximateDurationMs(transcriptText));
    const segments = allocateTimings(guarded.output, {
        baseStartMs,
        durationMs
    });
    return {
        transcriptText,
        segments,
        provider: provider.name,
        warnings,
        diarizationTrace: diarized.trace
    };
}
//# sourceMappingURL=sttService.js.map