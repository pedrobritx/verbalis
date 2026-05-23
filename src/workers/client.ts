import { wrap, type Remote } from 'comlink'
import type { ParsingWorker } from './parsing.worker'

let cached: Remote<ParsingWorker> | null = null

export function getParsingWorker(): Remote<ParsingWorker> {
  if (cached) return cached
  const worker = new Worker(new URL('./parsing.worker.ts', import.meta.url), { type: 'module' })
  cached = wrap<ParsingWorker>(worker)
  return cached
}
