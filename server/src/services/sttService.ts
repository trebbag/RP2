import fs from "node:fs/promises"
import path from "node:path"
import { z } from "zod"
import { env } from "../config/env.js"
import { runJsonTask, type OrchestrationTrace } from "./orchestrationService.js"
import { buildPromptBundle, type PromptProfile } from "./promptBuilderService.js"
import { enforceDiarizationGuardrails } from "./aiGuardrailService.js"

interface SttSegment {
  text: string
  startSec?: number
  endSec?: number
}

interface TranscribeInput {
  filePath: string
  mimeType: string
  speakerHint?: string
  speakerHints?: string[]
  sessionElapsedMs?: number
  chunkDurationMs?: number
  lastKnownEndMs: number
  promptProfile?: PromptProfile
}

export interface DiarizedTranscriptSegment {
  speaker: string
  speakerLabel?: string
  text: string
  startMs: number
  endMs: number
  confidence?: number
}

export interface TranscribeOutput {
  transcriptText: string
  segments: DiarizedTranscriptSegment[]
  provider: "openai" | "fallback"
  warnings: string[]
  diarizationTrace?: OrchestrationTrace
}

const diarizationSchema = z.object({
  segments: z
    .array(
      z.object({
        speaker: z.string().min(1),
        speakerLabel: z.string().optional(),
        text: z.string().min(1),
        confidence: z.number().min(0).max(1).optional()
      })
    )
    .min(1)
})

function normalizeSpeaker(value: string | undefined): string {
  if (!value) return "Speaker 1"
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : "Speaker 1"
}

function naiveDiarization(text: string, speakerHint?: string): Array<{
  speaker: string
  speakerLabel?: string
  text: string
  confidence?: number
}> {
  const cleaned = text.trim()
  if (!cleaned) return []

  const chunks = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)

  if (chunks.length === 0) {
    return [
      {
        speaker: normalizeSpeaker(speakerHint),
        speakerLabel: normalizeSpeaker(speakerHint),
        text: cleaned,
        confidence: 0.72
      }
    ]
  }

  return chunks.map((chunk) => ({
    speaker: normalizeSpeaker(speakerHint),
    speakerLabel: normalizeSpeaker(speakerHint),
    text: chunk,
    confidence: 0.72
  }))
}

function approximateDurationMs(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length
  return Math.max(2500, words * 420)
}

function allocateTimings(
  segments: Array<{ speaker: string; speakerLabel?: string; text: string; confidence?: number }>,
  options: {
    baseStartMs: number
    durationMs: number
  }
): DiarizedTranscriptSegment[] {
  const totalChars = segments.reduce((sum, segment) => sum + Math.max(segment.text.length, 1), 0)
  let cursor = options.baseStartMs

  return segments.map((segment, index) => {
    const weight = Math.max(segment.text.length, 1) / Math.max(totalChars, 1)
    const rawDuration = Math.round(options.durationMs * weight)
    const minDuration = 600
    const remaining = options.baseStartMs + options.durationMs - cursor
    const duration = index === segments.length - 1 ? Math.max(remaining, minDuration) : Math.max(rawDuration, minDuration)
    const startMs = cursor
    const endMs = startMs + duration
    cursor = endMs

    return {
      speaker: normalizeSpeaker(segment.speaker),
      speakerLabel: segment.speakerLabel,
      text: segment.text.trim(),
      startMs,
      endMs,
      confidence: segment.confidence
    }
  })
}

async function transcribeWithOpenAi(filePath: string, mimeType: string): Promise<{
  transcriptText: string
  sttSegments: SttSegment[]
}> {
  const apiKey = env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY missing")
  }

  const fileBuffer = await fs.readFile(filePath)
  const form = new FormData()
  form.append("model", env.OPENAI_STT_MODEL)
  form.append("response_format", "verbose_json")
  form.append("file", new Blob([fileBuffer], { type: mimeType || "audio/webm" }), path.basename(filePath))

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`
    },
    body: form
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`OpenAI STT error ${response.status}: ${body.slice(0, 280)}`)
  }

  const payload = (await response.json()) as {
    text?: string
    segments?: Array<{
      text?: string
      start?: number
      end?: number
    }>
  }

  const transcriptText = payload.text?.trim() ?? ""
  const sttSegments: SttSegment[] =
    payload.segments?.map((segment) => ({
      text: segment.text?.trim() ?? "",
      startSec: segment.start,
      endSec: segment.end
    })) ?? []

  return {
    transcriptText,
    sttSegments
  }
}

async function diarizeText(input: {
  transcriptText: string
  speakerHint?: string
  speakerHints?: string[]
  promptProfile?: PromptProfile
}) {
  const hints = input.speakerHints?.filter(Boolean) ?? env.DIARIZATION_SPEAKERS.split(",").map((item) => item.trim()).filter(Boolean)
  const prompt = buildPromptBundle({
    task: "diarization",
    profile: input.promptProfile,
    runtimeContext: {
      speakerHint: input.speakerHint ?? null,
      preferredSpeakers: hints
    }
  })
  const result = await runJsonTask({
    task: "diarization",
    instructions: `${prompt.instructions}\nPreferred speaker labels: ${hints.join(", ") || "Doctor, Patient"}.`,
    input: {
      transcriptText: input.transcriptText,
      speakerHint: input.speakerHint,
      speakerHints: hints
    },
    schema: diarizationSchema,
    fallback: () => ({
      segments: naiveDiarization(input.transcriptText, input.speakerHint)
    }),
    promptVersionId: prompt.versionId,
    promptProfileDigest: prompt.metadata.profileDigest,
    promptOverridesApplied: prompt.metadata.overridesApplied,
    maxOutputTokens: 1800
  })
  return {
    ...result,
    prompt
  }
}

export async function diarizeTranscriptText(input: {
  transcriptText: string
  speakerHint?: string
  speakerHints?: string[]
  promptProfile?: PromptProfile
}) {
  const diarized = await diarizeText(input)
  return {
    segments: diarized.output.segments,
    trace: diarized.trace,
    prompt: diarized.prompt
  }
}

export async function transcribeAndDiarizeAudio(input: TranscribeInput): Promise<TranscribeOutput> {
  const warnings: string[] = []
  let provider: "openai" | "fallback" = "openai"

  let transcriptText = ""
  let sttSegments: SttSegment[] = []

  try {
    const transcribed = await transcribeWithOpenAi(input.filePath, input.mimeType)
    transcriptText = transcribed.transcriptText
    sttSegments = transcribed.sttSegments
  } catch (error) {
    provider = "fallback"
    const message = error instanceof Error ? error.message : "Unknown STT error"
    warnings.push(message)
  }

  if (!transcriptText.trim()) {
    return {
      transcriptText: "",
      segments: [],
      provider,
      warnings,
      diarizationTrace: undefined
    }
  }

  const diarized = await diarizeText({
    transcriptText,
    speakerHint: input.speakerHint,
    speakerHints: input.speakerHints,
    promptProfile: input.promptProfile
  })
  const guarded = enforceDiarizationGuardrails({
    segments: diarized.output.segments,
    transcriptText,
    speakerHint: input.speakerHint,
    preferredSpeakers: input.speakerHints
  })

  if (diarized.trace.fallback) {
    provider = "fallback"
    if (diarized.trace.error) warnings.push(diarized.trace.error)
  }
  warnings.push(...guarded.warnings)

  const inferredStartFromClock =
    typeof input.sessionElapsedMs === "number"
      ? Math.max(0, input.sessionElapsedMs - (input.chunkDurationMs ?? 0))
      : 0
  const baseStartMs = Math.max(0, input.lastKnownEndMs, inferredStartFromClock)
  const durationFromSegments = sttSegments.length
    ? Math.max(
        1500,
        Math.round(
          Math.max(
            0,
            (sttSegments[sttSegments.length - 1]?.endSec ?? 0) - (sttSegments[0]?.startSec ?? 0)
          ) * 1000
        )
      )
    : 0
  const durationMs =
    input.chunkDurationMs ??
    (durationFromSegments > 0 ? durationFromSegments : approximateDurationMs(transcriptText))
  const segments = allocateTimings(guarded.output, {
    baseStartMs,
    durationMs
  })

  return {
    transcriptText,
    segments,
    provider,
    warnings,
    diarizationTrace: diarized.trace
  }
}
