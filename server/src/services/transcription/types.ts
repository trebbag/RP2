import type { PhiText } from "../../phi.js"

export type TranscriptionProviderName = "openai" | "offlineMock"

export interface TranscribeAudioChunkInput {
  filePath: string
  mimeType: string
}

export interface TranscribeAudioChunkOutput {
  transcriptText: PhiText
  provider: TranscriptionProviderName
  warnings: string[]
}

export interface TranscriptionProvider {
  readonly name: TranscriptionProviderName
  transcribeAudioChunk(input: TranscribeAudioChunkInput): Promise<TranscribeAudioChunkOutput>
}
