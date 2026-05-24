import { useCallback, useState } from 'react'
import { tmRepo } from '@/storage/repositories/tmRepo'
import { embeddingsRepo } from '@/storage/repositories/embeddingsRepo'
import { getEmbeddingsWorker } from '@/workers/client'
import type { EmbeddingRecord } from '@/core/types'

export interface BuildState {
  building: boolean
  done: number
  total: number
  error: string | null
}

const CHUNK_SIZE = 16

export function useSemanticIndexBuilder(model: string) {
  const [state, setState] = useState<BuildState>({
    building: false,
    done: 0,
    total: 0,
    error: null,
  })

  const build = useCallback(async () => {
    setState({ building: true, done: 0, total: 0, error: null })
    try {
      await embeddingsRepo.deleteByModel(model)
      const entries = await tmRepo.getAll()
      setState((s) => ({ ...s, total: entries.length }))
      if (entries.length === 0) {
        setState({ building: false, done: 0, total: 0, error: null })
        return
      }
      const worker = getEmbeddingsWorker()
      const now = new Date().toISOString()
      for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
        const chunk = entries.slice(i, i + CHUNK_SIZE)
        const vectors = await worker.embedMany(
          chunk.map((e) => e.source),
          model,
        )
        const records: EmbeddingRecord[] = chunk.map((entry, j) => {
          const vector = new Float32Array(vectors[j])
          return {
            id: crypto.randomUUID(),
            tmId: entry.id,
            model,
            dim: vector.length,
            vector,
            createdAt: now,
          }
        })
        await embeddingsRepo.bulkUpsert(records)
        setState((s) => ({ ...s, done: Math.min(s.total, i + chunk.length) }))
      }
      setState((s) => ({ ...s, building: false }))
    } catch (err) {
      setState({
        building: false,
        done: 0,
        total: 0,
        error: err instanceof Error ? err.message : 'failed',
      })
    }
  }, [model])

  return { state, build }
}
