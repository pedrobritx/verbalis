import { useQuery } from '@tanstack/react-query'
import { fetchCorpusManifest } from '@/core/corpus/manifest'
import type { CorpusManifest } from '@/core/corpus/types'

export function useCorpusManifest() {
  return useQuery<CorpusManifest>({
    queryKey: ['corpus-manifest'],
    queryFn: ({ signal }) => fetchCorpusManifest(signal),
    staleTime: Infinity,
    retry: 1,
  })
}
