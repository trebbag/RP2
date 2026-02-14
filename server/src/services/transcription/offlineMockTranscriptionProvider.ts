import { asPhiText } from "../../phi.js"
import type { TranscribeAudioChunkInput, TranscribeAudioChunkOutput, TranscriptionProvider } from "./types.js"

const DEFAULT_FIXTURE = [
  "Doctor: Hi, what brings you in today?",
  "Patient: I've had chest discomfort for two days.",
  "Doctor: Any shortness of breath or dizziness?",
  "Patient: No shortness of breath.",
  "Doctor: We'll do an EKG and review your risk factors."
].join("\n")

export class OfflineMockTranscriptionProvider implements TranscriptionProvider {
  readonly name = "offlineMock" as const

  async transcribeAudioChunk(_input: TranscribeAudioChunkInput): Promise<TranscribeAudioChunkOutput> {
    const fixture = process.env.OFFLINE_MOCK_TRANSCRIPT_FIXTURE?.trim() || DEFAULT_FIXTURE
    return {
      transcriptText: asPhiText(fixture),
      provider: this.name,
      warnings: ["Using offline mock transcription provider (deterministic fixture)."]
    }
  }
}
