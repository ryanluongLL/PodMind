import { Queue } from 'bullmq'
import { Redis } from 'ioredis'
console.log('REDIS_URL:', process.env.REDIS_URL)

const connection = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
})

export const transcriptionQueue = new Queue('transcription', { connection })

export async function enqueueTranscription(episodeId: string, audioUrl: string, userId: string) {
  await transcriptionQueue.add(
    'transcribe',
    { episodeId, audioUrl, userId },
    {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    }
  )
}