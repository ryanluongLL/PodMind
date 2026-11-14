import { pool } from "../db/index.js"

/// PodMind has no accounts, so anyone who finds the site can press
/// Transcribe. This cap keeps the worst case bill fixed: once the paid audio
/// minutes in the last 24 hours reach the limit, paid transcription stops
/// until older usage ages out. Free feed transcripts never count.

export const DEFAULT_DAILY_MINUTES = 120

/// The worker compresses audio to 16 kbps before transcribing, so the file
/// size gives the length without decoding it: 16,000 bits per second.
export const COMPRESSED_BITS_PER_SECOND = 16_000

export const DAILY_LIMIT_MESSAGE = "Daily transcription limit reached. Try again tomorrow."

type Env = Record<string, string | undefined>

/// DAILY_PAID_TRANSCRIPTION_MINUTES sets the cap. 0 turns paid transcription
/// off, so only free feed transcripts work. A missing or invalid value falls
/// back to the default instead of turning the cap off.
export function dailyLimitSeconds(env: Env = process.env): number {
  const raw = env.DAILY_PAID_TRANSCRIPTION_MINUTES?.trim()
  if (!raw) {
    return DEFAULT_DAILY_MINUTES * 60
  }
  const minutes = Number(raw)
  if (!Number.isFinite(minutes) || minutes < 0) {
    return DEFAULT_DAILY_MINUTES * 60
  }
  return Math.floor(minutes * 60)
}

export function estimateSeconds(compressedBytes: number): number {
  return Math.ceil((compressedBytes * 8) / COMPRESSED_BITS_PER_SECOND)
}

export async function paidSecondsLast24Hours(): Promise<number> {
  const { rows } = await pool.query<{ used: number }>(
    `SELECT COALESCE(SUM(paid_seconds), 0)::int AS used
     FROM transcripts
     WHERE paid_seconds IS NOT NULL AND completed_at > now() - interval '24 hours'`
  )
  return rows[0]?.used ?? 0
}

export async function remainingSeconds(env: Env = process.env): Promise<number> {
  const used = await paidSecondsLast24Hours()
  return Math.max(0, dailyLimitSeconds(env) - used)
}