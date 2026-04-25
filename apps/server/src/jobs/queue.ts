import { Queue } from "bullmq";

export const transcriptionQueue = new Queue('transcription', {
    connection: {
        host: 'localhost',
        port: 6379,
    },
})

export async function enqueueTranscription(episodeId: string, audioUrl: string, userId:string) {
    await transcriptionQueue.add(
        'transcribe',
        { episodeId, audioUrl, userId },
        {
            attempts: 3,
            backoff: {type: 'exponential', delay:5000}
        }
    )
}