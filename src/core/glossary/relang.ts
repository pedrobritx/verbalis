import type { GlossaryEntry } from '@/core/types'

/**
 * Re-file a glossary entry's translations under a single chosen language code.
 * Used by the bulk "change language" action when terms were imported under the
 * wrong language. All existing translation values are preserved (de-duplicated,
 * joined with "; " so multi-sense splitting still works); an entry with no
 * translations is returned unchanged except for the empty map.
 */
export function relangEntry(entry: GlossaryEntry, lang: string): GlossaryEntry {
  const values = Array.from(
    new Set(
      Object.values(entry.translations)
        .flatMap((v) => v.split(/\s*;\s*/))
        .map((v) => v.trim())
        .filter(Boolean),
    ),
  )
  return {
    ...entry,
    translations: values.length > 0 ? { [lang]: values.join('; ') } : {},
  }
}
