import { expose } from 'comlink'
import { embed, embedMany, cosine } from '@/core/embeddings'

const embeddingsApi = {
  embed: (text: string, model: string): Promise<Float32Array> => embed(text, model),
  embedMany: (texts: string[], model: string): Promise<Float32Array[]> => embedMany(texts, model),
  embedAndRank: async (
    query: string,
    model: string,
    candidates: Array<{ tmId: string; vector: Float32Array }>,
    topK: number,
    threshold: number,
  ): Promise<Array<{ tmId: string; score: number }>> => {
    if (candidates.length === 0) return []
    const q = await embed(query, model)
    const scored = candidates
      .map((c) => ({ tmId: c.tmId, score: cosine(q, c.vector) }))
      .filter((x) => x.score >= threshold)
      .sort((a, b) => b.score - a.score)
    return scored.slice(0, topK)
  },
}

export type EmbeddingsWorker = typeof embeddingsApi
expose(embeddingsApi)
