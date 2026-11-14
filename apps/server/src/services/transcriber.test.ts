import fs from "fs"
import os from "os"
import { once } from "events"
import path from "path"
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest"
import { providerFromEnv, toSegments, transcribeFile, type ProviderConfig, type TranscribeCall, type TranscriptionRequest } from "./transcriber.js"

describe("providerFromEnv", () => {
  it("uses Groq when its key is set, because it is cheaper", () => {
    const config = providerFromEnv({ GROQ_API_KEY: "groq-key", OPENAI_API_KEY: "openai-key" })
    expect(config).toEqual({
      name: "groq",
      apiKey: "groq-key",
      baseURL: "https://api.groq.com/openai/v1",
      model: "whisper-large-v3-turbo",
      maxBytes: 25 * 1024 * 1024,
    })
  })

  it("falls back to OpenAI when only its key is set", () => {
    const config = providerFromEnv({ OPENAI_API_KEY: "openai-key" })
    expect(config).toMatchObject({ name: "openai", apiKey: "openai-key", model: "whisper-1", baseURL: undefined })
  })

  it("honors an explicit choice, in any case", () => {
    const config = providerFromEnv({ TRANSCRIPTION_PROVIDER: " OpenAI ", GROQ_API_KEY: "g", OPENAI_API_KEY: "o" })
    expect(config?.name).toBe("openai")
    expect(providerFromEnv({ TRANSCRIPTION_PROVIDER: "groq", GROQ_API_KEY: "g", OPENAI_API_KEY: "o" })?.name).toBe("groq")
  })

  it("does not quietly switch providers when the chosen one has no key", () => {
    expect(providerFromEnv({ TRANSCRIPTION_PROVIDER: "openai", GROQ_API_KEY: "g" })).toBeNull()
    expect(providerFromEnv({ TRANSCRIPTION_PROVIDER: "groq", OPENAI_API_KEY: "o" })).toBeNull()
  })

  it("returns null when no key is set or keys are blank", () => {
    expect(providerFromEnv({})).toBeNull()
    expect(providerFromEnv({ GROQ_API_KEY: "  ", OPENAI_API_KEY: "" })).toBeNull()
  })
})

describe("toSegments", () => {
  it("trims text and drops empty segments", () => {
    expect(
      toSegments([
        { start: 0, end: 2, text: "  Hello there. " },
        { start: 2, end: 3, text: "   " },
        { start: 3, end: 5, text: "Welcome." },
      ])
    ).toEqual([
      { start: 0, end: 2, text: "Hello there." },
      { start: 3, end: 5, text: "Welcome." },
    ])
  })

  it("handles a response without segments", () => {
    expect(toSegments(undefined)).toEqual([])
  })
})

/// The real SDK reads the whole file stream. The fakes do the same, so the
/// file is closed before the temporary folder is deleted, which Windows needs.
async function readStream(request: TranscriptionRequest): Promise<void> {
  request.file.resume()
  await once(request.file, "close")
}

describe("transcribeFile", () => {
  let dir: string
  let audioPath: string
  const config: ProviderConfig = {
    name: "groq",
    apiKey: "test-key",
    baseURL: "https://api.groq.com/openai/v1",
    model: "whisper-large-v3-turbo",
    maxBytes: 1000,
  }

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "podmind-transcriber-"))
    audioPath = path.join(dir, "episode.mp3")
    fs.writeFileSync(audioPath, Buffer.alloc(500))
  })

  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it("sends the file with the provider's model and maps the result", async () => {
    const call: TranscribeCall = vi.fn(async (request) => {
      await readStream(request)
      return {
        text: " Hello there. Welcome. ",
        duration: 5.5,
        segments: [
          { start: 0, end: 2, text: " Hello there." },
          { start: 2, end: 5.5, text: " Welcome." },
        ],
      }
    })

    const result = await transcribeFile(audioPath, config, call)

    expect(result).toEqual({
      fullText: "Hello there. Welcome.",
      segments: [
        { start: 0, end: 2, text: "Hello there." },
        { start: 2, end: 5.5, text: "Welcome." },
      ],
      durationSeconds: 5.5,
    })
    expect(call).toHaveBeenCalledWith({
      file: expect.any(fs.ReadStream),
      model: "whisper-large-v3-turbo",
      response_format: "verbose_json",
    })
  })

  it("reports a missing duration as null", async () => {
    const call: TranscribeCall = vi.fn(async (request) => {
      await readStream(request)
      return { text: "Hi." }
    })
    const result = await transcribeFile(audioPath, config, call)
    expect(result).toEqual({ fullText: "Hi.", segments: [], durationSeconds: null })
  })

  it("refuses a file over the provider's limit without calling it", async () => {
    const call: TranscribeCall = vi.fn()
    await expect(transcribeFile(audioPath, { ...config, maxBytes: 100 }, call)).rejects.toThrow(
      "over the groq upload limit"
    )
    expect(call).not.toHaveBeenCalled()
  })
})