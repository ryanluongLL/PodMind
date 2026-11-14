import fs from "fs"
import OpenAI from "openai"
import type { Segment } from "../transcripts/feedTranscript.js"

/// Paid transcription, behind one interface. Groq runs Whisper Large v3
/// Turbo on an OpenAI compatible endpoint for a fraction of OpenAI's price,
/// so both providers use the same SDK and only the address, key, and model
/// change. OpenAI stays as a fallback for anyone without a Groq key.

export type ProviderName = "groq" | "openai"

export interface ProviderConfig {
  name: ProviderName
  apiKey: string
  baseURL: string | undefined
  model: string
  /// Largest upload the provider accepts. The worker checks this before
  /// sending, so an oversized file fails fast instead of costing a request.
  maxBytes: number
}

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

const GROQ: Omit<ProviderConfig, "apiKey"> = {
  name: "groq",
  baseURL: "https://api.groq.com/openai/v1",
  model: "whisper-large-v3-turbo",
  maxBytes: MAX_UPLOAD_BYTES,
}

const OPENAI: Omit<ProviderConfig, "apiKey"> = {
  name: "openai",
  baseURL: undefined,
  model: "whisper-1",
  maxBytes: MAX_UPLOAD_BYTES,
}

type Env = Record<string, string | undefined>

/// TRANSCRIPTION_PROVIDER picks a provider on purpose. Without it, Groq is
/// used whenever its key is set, because it is the cheaper one.
/// Returns null when no provider has a key, so the worker can say so clearly.
export function providerFromEnv(env: Env = process.env): ProviderConfig | null {
  const preferred = env.TRANSCRIPTION_PROVIDER?.trim().toLowerCase()
  const groqKey = env.GROQ_API_KEY?.trim()
  const openaiKey = env.OPENAI_API_KEY?.trim()

  if (preferred === "openai") {
    if (openaiKey) {
      return { ...OPENAI, apiKey: openaiKey }
    }
    return null
  }
  if (preferred === "groq") {
    if (groqKey) {
      return { ...GROQ, apiKey: groqKey }
    }
    return null
  }

  if (groqKey) {
    return { ...GROQ, apiKey: groqKey }
  }
  if (openaiKey) {
    return { ...OPENAI, apiKey: openaiKey }
  }
  return null
}

/// The verbose_json fields both providers send back
export interface VerboseTranscription {
  text: string
  duration?: number
  segments?: { start: number; end: number; text: string }[]
}

export interface TranscriptionRequest {
  file: fs.ReadStream
  model: string
  response_format: "verbose_json"
}

/// The single call this file makes. Tests pass a fake, so no test ever
/// spends money or needs a key.
export type TranscribeCall = (request: TranscriptionRequest) => Promise<VerboseTranscription>

function sdkCall(config: ProviderConfig): TranscribeCall {
  const client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseURL })
  return (request) => client.audio.transcriptions.create(request)
}

export function toSegments(raw: VerboseTranscription["segments"]): Segment[] {
  const segments: Segment[] = []
  for (const segment of raw ?? []) {
    const text = segment.text.trim()
    if (text !== "") {
      segments.push({ start: segment.start, end: segment.end, text })
    }
  }
  return segments
}

export async function transcribeFile(
  filePath: string,
  config: ProviderConfig,
  call: TranscribeCall = sdkCall(config)
): Promise<{ fullText: string; segments: Segment[]; durationSeconds: number | null }> {
  const size = fs.statSync(filePath).size
  if (size > config.maxBytes) {
    const megabytes = (size / 1024 / 1024).toFixed(1)
    throw new Error(`Episode too long to transcribe: ${megabytes} MB is over the ${config.name} upload limit`)
  }

  /// verbose_json gives segment timestamps for the synchronized player
  const result = await call({
    file: fs.createReadStream(filePath),
    model: config.model,
    response_format: "verbose_json",
  })

  return {
    fullText: result.text.trim(),
    segments: toSegments(result.segments),
    durationSeconds: result.duration ?? null,
  }
}