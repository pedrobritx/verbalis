export interface WiktionaryDefinition {
  partOfSpeech: string
  language: string
  definition: string
  examples?: string[]
}

export interface WiktionaryResult {
  term: string
  sourceLang: string
  definitions: WiktionaryDefinition[]
  translations: Record<string, string>
}

export type WiktionaryErrorCode = 'not_found' | 'network' | 'parse' | 'invalid'

export class WiktionaryError extends Error {
  code: WiktionaryErrorCode
  constructor(code: WiktionaryErrorCode, message: string) {
    super(message)
    this.code = code
    this.name = 'WiktionaryError'
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim()
}

// Parse translation templates of the form {{t|lang|target}} or {{t+|lang|target}}
// out of wikitext. Best-effort — captures the first translation per language.
export function parseTranslationsFromWikitext(wikitext: string): Record<string, string> {
  const out: Record<string, string> = {}
  const re = /\{\{t\+?\|([a-z-]{2,10})\|([^|}]+?)(?:\|[^}]*)?\}\}/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(wikitext)) !== null) {
    const lang = m[1].toLowerCase()
    const value = m[2].trim()
    if (!value) continue
    if (out[lang]) continue
    out[lang] = value
  }
  return out
}

interface DefinitionResponseItem {
  partOfSpeech: string
  language: string
  definitions: Array<{ definition: string; examples?: string[] }>
}
type DefinitionResponse = Record<string, DefinitionResponseItem[]>

export async function fetchWiktionaryEntry(
  term: string,
  lang = 'en',
  fetchImpl: typeof fetch = fetch,
): Promise<WiktionaryResult> {
  const trimmed = term.trim()
  if (!trimmed) throw new WiktionaryError('invalid', 'Term is empty')

  // Wiktionary has one wiki per base language (en.wiktionary.org, pt.wiktionary.org),
  // not per regional variant, so strip any subtag (pt-BR → pt).
  const wikiLang = lang.split('-')[0].toLowerCase()
  const defUrl = `https://${wikiLang}.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(
    trimmed,
  )}`

  let defResp: Response
  try {
    defResp = await fetchImpl(defUrl, {
      headers: { Accept: 'application/json' },
    })
  } catch (err) {
    throw new WiktionaryError('network', err instanceof Error ? err.message : 'fetch failed')
  }

  if (!defResp.ok) {
    // The REST definition endpoint returns 404 for missing pages and 501 for
    // titles it can't route (multi-word phrases, special characters, redirects
    // to non-dictionary pages). Either way, there's no entry to show — treat
    // it as "not found" so the UI can degrade gracefully instead of leaking
    // an HTTP status code.
    throw new WiktionaryError(
      'not_found',
      `Term "${trimmed}" not found on Wiktionary`,
    )
  }

  let defJson: DefinitionResponse
  try {
    defJson = (await defResp.json()) as DefinitionResponse
  } catch (err) {
    throw new WiktionaryError('parse', err instanceof Error ? err.message : 'invalid JSON')
  }

  const definitions: WiktionaryDefinition[] = []
  for (const items of Object.values(defJson)) {
    for (const item of items) {
      for (const d of item.definitions ?? []) {
        const clean = stripHtml(d.definition)
        if (!clean) continue
        definitions.push({
          partOfSpeech: item.partOfSpeech,
          language: item.language,
          definition: clean,
          examples: d.examples?.map(stripHtml).filter(Boolean),
        })
      }
    }
  }

  // Best-effort translations via MediaWiki action API.
  let translations: Record<string, string> = {}
  try {
    const tUrl = `https://${wikiLang}.wiktionary.org/w/api.php?action=parse&page=${encodeURIComponent(
      trimmed,
    )}&prop=wikitext&format=json&origin=*`
    const tResp = await fetchImpl(tUrl, { headers: { Accept: 'application/json' } })
    if (tResp.ok) {
      const tJson = (await tResp.json()) as {
        parse?: { wikitext?: { '*': string } }
      }
      const wt = tJson.parse?.wikitext?.['*']
      if (typeof wt === 'string') {
        translations = parseTranslationsFromWikitext(wt)
      }
    }
  } catch {
    // Degrade gracefully — definitions alone are still useful.
  }

  return {
    term: trimmed,
    sourceLang: wikiLang,
    definitions,
    translations,
  }
}
