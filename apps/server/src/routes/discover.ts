import { Router } from "express";
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const router = Router()

interface PodcastToSummarize{
    name: string
    artist: string
    genre: string
    description?: string
    episodeCount:number
}


///POST /discover/summarize
///takes an array of podcasts from iTunes and returns AI-generated summaries
///we batch all 5 into one Claude call to minimize latency and cost
router.post('/summarize', async (req, res) => {
    const { podcasts, query } = req.body as {
        podcasts: PodcastToSummarize[]
        query:string
    }

    if (!podcasts || podcasts.length === 0) {
        res.status(400).json({ error: 'No podcasts provided' })
        return
    }
    try {
        const podcastList = podcasts.map((p, i) =>
            `${i + 1}. "${p.name}" by ${p.artist} (${p.genre}, ${p.episodeCount} episodes)
            ${p.description ? `Description: ${p.description.slice(0, 300)}` : 'No description available.'}`
        ).join('\n\n')

        const message = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1024,
            messages: [{
                role: 'user',
                content: `A user searched for "${query}" and got these podcast results from iTunes.
        For each podcast, write exactly 2 sentences explaining what it's about and why someone interested in "${query}" might enjoy it. Be specific and engaging, not generic.

        Respond ONLY with a JSON array of objects with this exact shape:
        [{"id": 1, "summary": "..."}, {"id": 2, "summary": "..."}, ...]

        Podcasts:
        ${podcastList}
                `
            }]
        })

        const text = message.content[0]?.type === 'text' ? message.content[0].text : '[]'
        const clean = text.replace(/``json|```/g, '').trim()
        const summaries = JSON.parse(clean)

        res.json({summaries})
    } catch (err) {
        console.error(err)
        res.status(500).json({error: "Failed to generate summaries"})
    }
})

export default router