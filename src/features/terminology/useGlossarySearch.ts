import { useMemo } from 'react'
import MiniSearch from 'minisearch'
import type { GlossaryEntry } from '@/core/types'

export function useGlossarySearch(entries: GlossaryEntry[] | undefined, query: string) {
  const index = useMemo(() => {
    if (!entries) return null
    const mini = new MiniSearch<{
      id: string
      term: string
      definition: string
      translations: string
      notes: string
    }>({
      fields: ['term', 'definition', 'translations', 'notes'],
      storeFields: ['id'],
      searchOptions: {
        boost: { term: 3, translations: 2 },
        fuzzy: 0.2,
        prefix: true,
      },
    })
    mini.addAll(
      entries.map((e) => ({
        id: e.id,
        term: e.term,
        definition: e.definition,
        translations: Object.values(e.translations).join(' '),
        notes: e.notes ?? '',
      })),
    )
    return mini
  }, [entries])

  return useMemo(() => {
    if (!entries) return []
    if (!query.trim()) return entries
    if (!index) return entries
    const ids = new Set(index.search(query).map((r) => r.id as string))
    return entries.filter((e) => ids.has(e.id))
  }, [entries, index, query])
}
