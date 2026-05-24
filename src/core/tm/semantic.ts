import type { TMEntry, TMMatch } from '@/core/types'
import { embeddingsRepo } from '@/storage/repositories/embeddingsRepo'

export interface SemanticMatchOptions {
  topK: number
  threshold: number
}

export interface EmbedAndRank {
  embedAndRank(
    query: string,
    model: string,
    candidates: Array<{ tmId: string; vector: Float32Array }>,
    topK: number,
    threshold: number,
  ): Promise<Array<{ tmId: string; score: number }>>
}

export async function findSemanticMatches(
  query: string,
  model: string,
  candidates: TMEntry[],
  opts: SemanticMatchOptions,
  ranker: EmbedAndRank,
): Promise<TMMatch[]> {
  const q = query.trim()
  if (!q || candidates.length === 0) return []
  const records = await embeddingsRepo.byModel(model)
  const byTmId = new Map<string, Float32Array>(
    records.map((r) => [
      r.tmId,
      // Defensive: structured-clone implementations occasionally hand back a
      // detached typed-array view; rewrapping is cheap and keeps the worker happy.
      r.vector instanceof Float32Array ? r.vector : new Float32Array(r.vector as ArrayLike<number>),
    ]),
  )
  const usable = candidates
    .filter((e) => byTmId.has(e.id))
    .map((e) => ({ tmId: e.id, vector: byTmId.get(e.id)! }))
  if (usable.length === 0) return []

  const ranked = await ranker.embedAndRank(q, model, usable, opts.topK, opts.threshold)
  const tmById = new Map(candidates.map((e) => [e.id, e]))
  const out: TMMatch[] = []
  for (const r of ranked) {
    const entry = tmById.get(r.tmId)
    if (!entry) continue
    out.push({ entry, score: r.score, isExact: false, similarityMethod: 'semantic' })
  }
  return out
}

export function mergeMatches(
  lexical: TMMatch[],
  semantic: TMMatch[],
  limit: number,
): TMMatch[] {
  const seen = new Map<string, TMMatch>()
  const annotatedLex = lexical.map((m) => ({
    ...m,
    similarityMethod: m.similarityMethod ?? ('lexical' as const),
  }))
  for (const m of [...annotatedLex, ...semantic]) {
    const existing = seen.get(m.entry.id)
    if (!existing) {
      seen.set(m.entry.id, m)
      continue
    }
    if (m.score > existing.score) {
      seen.set(m.entry.id, m)
    } else if (m.score === existing.score && m.similarityMethod === 'lexical') {
      // lexical wins on tie
      seen.set(m.entry.id, m)
    }
  }
  return Array.from(seen.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}
