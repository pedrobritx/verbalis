import { useLiveQuery } from 'dexie-react-hooks'
import { corpusRepo } from '@/storage/repositories/corpusRepo'

// All installed corpus terms. Kept in one place so the index is built once and
// shared (corpora are global, not project-scoped).
export function useCorpusCache() {
  return useLiveQuery(() => corpusRepo.getAllTerms(), [])
}
