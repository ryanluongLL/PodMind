import { Queue } from "bullmq"
import { Redis } from "ioredis"

/// The transcription queue lives in Redis. It is created the first time a job
/// is added, not when this file loads, so the API starts and serves every
/// other route even while Redis is down or not configured (the end to end
/// tests run the API without Redis at all).

let transcriptionQueue: Queue | null = null

function getQueue(): Queue {
  if (transcriptionQueue === null) {
    const connection = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
      maxRetriesPerRequest: null,
    })
    transcriptionQueue = new Queue("transcription", { connection })
  }
  return transcriptionQueue
}

export async function enqueueTranscription(episodeId: string, audioUrl: string): Promise<void> {
  await getQueue().add(
    "transcribe",
    { episodeId, audioUrl },
    {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
    }
  )
}