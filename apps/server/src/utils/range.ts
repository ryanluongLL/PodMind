/// Parses an HTTP Range header for one file, so the audio route can let the
/// browser seek. Follows the HTTP rules:
///   "bytes=100-199"  bytes 100 to 199
///   "bytes=100-"     from byte 100 to the end
///   "bytes=-500"     the last 500 bytes
/// A header that cannot be read, or that asks for several ranges, is ignored
/// and the whole file is sent. A range that starts past the end of the file
/// cannot be served at all (416).

export type RangeResult =
  | { kind: "full" }
  | { kind: "partial"; start: number; end: number }
  | { kind: "unsatisfiable" }

const SINGLE_RANGE = /^bytes=(\d*)-(\d*)$/

export function parseRange(header: string | undefined, fileSize: number): RangeResult {
  if (!header) {
    return { kind: "full" }
  }
  const match = SINGLE_RANGE.exec(header.trim())
  if (!match) {
    return { kind: "full" }
  }
  const startText = match[1] ?? ""
  const endText = match[2] ?? ""

  if (startText.length === 0 && endText.length === 0) {
    return { kind: "full" }
  }

  /// Suffix range: the last N bytes
  if (startText.length === 0) {
    const suffix = Number(endText)
    if (suffix === 0 || fileSize === 0) {
      return { kind: "unsatisfiable" }
    }
    return { kind: "partial", start: Math.max(0, fileSize - suffix), end: fileSize - 1 }
  }

  const start = Number(startText)
  let end = fileSize - 1
  if (endText.length > 0) {
    end = Number(endText)
    if (end < start) {
      return { kind: "full" }
    }
  }

  if (start >= fileSize) {
    return { kind: "unsatisfiable" }
  }
  return { kind: "partial", start, end: Math.min(end, fileSize - 1) }
}