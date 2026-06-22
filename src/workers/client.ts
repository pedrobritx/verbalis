import { wrap, type Remote } from 'comlink'
import type { ParsingWorker } from './parsing.worker'
import type { EmbeddingsWorker } from './embeddings.worker'
import type { SpellWorker } from './spell.worker'

let cachedParsing: Remote<ParsingWorker> | null = null
let cachedEmbeddings: Remote<EmbeddingsWorker> | null = null
let cachedSpell: Remote<SpellWorker> | null = null

export function getParsingWorker(): Remote<ParsingWorker> {
  if (cachedParsing) return cachedParsing
  const worker = new Worker(new URL('./parsing.worker.ts', import.meta.url), { type: 'module' })
  cachedParsing = wrap<ParsingWorker>(worker)
  return cachedParsing
}

export function getEmbeddingsWorker(): Remote<EmbeddingsWorker> {
  if (cachedEmbeddings) return cachedEmbeddings
  const worker = new Worker(new URL('./embeddings.worker.ts', import.meta.url), { type: 'module' })
  cachedEmbeddings = wrap<EmbeddingsWorker>(worker)
  return cachedEmbeddings
}

export function getSpellWorker(): Remote<SpellWorker> {
  if (cachedSpell) return cachedSpell
  const worker = new Worker(new URL('./spell.worker.ts', import.meta.url), { type: 'module' })
  cachedSpell = wrap<SpellWorker>(worker)
  return cachedSpell
}
