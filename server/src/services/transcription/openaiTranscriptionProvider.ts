import fs from "node:fs/promises"
import path from "node:path"
import { env } from "../../config/env.js"
import { logger } from "../../lib/logger.js"
import { asPhiText } from "../../phi.js"
import type { TranscribeAudioChunkInput, TranscribeAudioChunkOutput, TranscriptionProvider } from "./types.js"

interface OpenAiTranscriptionResponse {
  text?: string
}

export class OpenAITranscriptionProvider implements TranscriptionProvider {
  readonly name = "openai" as const

  async transcribeAudioChunk(input: TranscribeAudioChunkInput): Promise<TranscribeAudioChunkOutput> {
    if (!env.OPENAI_API_KEY) {
      return {
        transcriptText: asPhiText(""),
        provider: this.name,
        warnings: ["OPENAI_API_KEY missing; cannot transcribe audio."]
      }
    }

    const model = env.OPENAI_STT_MODEL
    const buffer = await fs.readFile(input.filePath)
    const fileName = path.basename(input.filePath)

    const form = new FormData()
    form.append("model", model)
    form.append("file", new Blob([buffer], { type: input.mimeType || "application/octet-stream" }), fileName)

    const startedAt = Date.now()
    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`
      },
      body: form
    })

    if (!response.ok) {
      const errorText = await response.text()
      logger.warn("stt.openai_transcription_failed", {
        status: response.status,
        durationMs: Date.now() - startedAt,
        fileName,
        bytes: buffer.byteLength
      })
      return {
        transcriptText: asPhiText(""),
        provider: this.name,
        warnings: [`OpenAI transcription failed (${response.status}): ${errorText.slice(0, 200)}`]
      }
    }

    const payload = (await response.json()) as OpenAiTranscriptionResponse
    const transcript = typeof payload.text === "string" ? payload.text : ""

    logger.info("stt.openai_transcription_succeeded", {
      durationMs: Date.now() - startedAt,
      fileName,
      bytes: buffer.byteLength,
      chars: transcript.length,
      model
    })

    return {
      transcriptText: asPhiText(transcript),
      provider: this.name,
      warnings: []
    }
  }
}
