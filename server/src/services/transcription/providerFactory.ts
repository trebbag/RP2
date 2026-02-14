import { env } from "../../config/env.js"
import type { TranscriptionProvider } from "./types.js"
import { OfflineMockTranscriptionProvider } from "./offlineMockTranscriptionProvider.js"
import { OpenAITranscriptionProvider } from "./openaiTranscriptionProvider.js"

let cached: TranscriptionProvider | null = null

export function getTranscriptionProvider(): TranscriptionProvider {
  if (cached) return cached

  switch (env.TRANSCRIPTION_PROVIDER) {
    case "openai":
      cached = new OpenAITranscriptionProvider()
      return cached
    case "offlineMock":
      cached = new OfflineMockTranscriptionProvider()
      return cached
    default:
      cached = new OfflineMockTranscriptionProvider()
      return cached
  }
}

export function resetTranscriptionProviderForTests() {
  cached = null
}
