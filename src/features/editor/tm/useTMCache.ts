import { useLiveQuery } from 'dexie-react-hooks'
import { tmRepo } from '@/storage/repositories/tmRepo'

export function useTMCache(sourceLang: string | undefined, targetLang: string | undefined) {
  return useLiveQuery(
    () => (sourceLang && targetLang ? tmRepo.byLangPair(sourceLang, targetLang) : []),
    [sourceLang, targetLang],
  )
}
