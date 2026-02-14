import { type OrchestrationTrace } from "./orchestrationService.js";
import { type PromptProfile } from "./promptBuilderService.js";
interface TranscribeInput {
    filePath: string;
    mimeType: string;
    speakerHint?: string;
    speakerHints?: string[];
    sessionElapsedMs?: number;
    chunkDurationMs?: number;
    lastKnownEndMs: number;
    promptProfile?: PromptProfile;
}
export interface DiarizedTranscriptSegment {
    speaker: string;
    speakerLabel?: string;
    text: string;
    startMs: number;
    endMs: number;
    confidence?: number;
}
export interface TranscribeOutput {
    transcriptText: string;
    segments: DiarizedTranscriptSegment[];
    provider: "openai" | "offlineMock" | "fallback";
    warnings: string[];
    diarizationTrace?: OrchestrationTrace;
}
export declare function diarizeTranscriptText(input: {
    transcriptText: string;
    speakerHint?: string;
    speakerHints?: string[];
    promptProfile?: PromptProfile;
}): Promise<{
    segments: {
        speaker: string;
        text: string;
        speakerLabel?: string;
        confidence?: number;
    }[];
    trace: OrchestrationTrace;
    prompt: import("./promptBuilderService.js").PromptBundle;
}>;
export declare function transcribeAndDiarizeAudio(input: TranscribeInput): Promise<TranscribeOutput>;
export {};
