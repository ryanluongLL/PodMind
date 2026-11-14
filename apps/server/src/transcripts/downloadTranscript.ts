import { isAllowedFeedUrl } from "../discover/feedPreview.js"
import { parseTranscript, type Segment, type TranscriptFormat } from "./feedTranscript.js"

/// A one hour episode's VTT file is usually under 200 KB, so anything past
/// this is not a transcript we want to hold in memory.
export const MAX_TRANSCRIPT_BYTES = 5 * 1024 * 1024
export const DOWNLOAD_TIMEOUT_MS = 15_000

/// The parts of fetch this file uses. Tests pass a fake that returns a
/// Response, so no test ever touches the network.
export type FetchLike = (url: string, init: { signal: AbortSignal }) => Promise<Response>

/// Downloads and parses a transcript the publisher links in its feed.
/// Never throws: any problem (blocked address, timeout, error status, huge
/// file, unparsable content) returns null, and the worker falls back to
/// paid transcription instead of failing the job.
export async function downloadTranscript(
  url: string,
  format: TranscriptFormat | null,
  fetchImpl: FetchLike = fetch
): Promise<{ fullText: string; segments: Segment[] } | null> {
  /// The URL comes from someone else's feed, so the same guard as Discover
  /// keeps the server from being pointed at its own private network.
  if (!isAllowedFeedUrl(url)) {
    console.warn(`[transcript] blocked address ${url}`)
    return null
  }

  try {
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) })
    if (!res.ok) {
      console.warn(`[transcript] ${url} answered ${res.status}`)
      return null
    }

    const declaredBytes = Number(res.headers.get("content-length") ?? 0)
    if (declaredBytes > MAX_TRANSCRIPT_BYTES) {
      console.warn(`[transcript] ${url} is too large (${declaredBytes} bytes)`)
      return null
    }

    /// Content-Length can be missing or wrong, so check the real size too
    const content = await res.text()
    if (Buffer.byteLength(content) > MAX_TRANSCRIPT_BYTES) {
      console.warn(`[transcript] ${url} is too large`)
      return null
    }

    return parseTranscript(content, format)
  } catch (err) {
    console.warn(`[transcript] could not download ${url}`, err)
    return null
  }
}