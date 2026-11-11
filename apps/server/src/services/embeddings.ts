import OpenAI from "openai"

/// The only place search talks to OpenAI. Tests replace this module with a
/// fake. The client is created on first use, so a missing key only breaks
/// search instead of stopping the whole server from starting.

const EMBEDDING_MODEL = "text-embedding-3-small"

let client: OpenAI | null = null

function getClient(): OpenAI {
  if (client === null) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return client
}

export async function embedQuery(text: string): Promise<number[]> {
  const res = await getClient().embeddings.create({ model: EMBEDDING_MODEL, input: text })
  const vector = res.data[0]?.embedding
  if (!vector) {
    throw new Error("OpenAI returned no embedding")
  }
  return vector
}