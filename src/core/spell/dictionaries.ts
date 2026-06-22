// On-demand loading of the bundled Hunspell dictionaries (public/dictionaries/),
// mirroring core/corpus/manifest.ts: static assets fetched relative to BASE_URL,
// cached by the service worker (a runtimeCaching rule), never bundled into JS.

export interface RawDictionary {
  aff: string
  dic: string
}

/** Languages we ship a dictionary for (matches the stripped target lang). */
export const SUPPORTED_SPELL_LANGS = ['en', 'pt'] as const
export type SpellLang = (typeof SUPPORTED_SPELL_LANGS)[number]

/** Map a project's target language (e.g. `pt-BR`, `en-GB`) to a shipped dict. */
export function resolveSpellLang(targetLang: string | undefined): SpellLang | null {
  const base = (targetLang ?? '').split('-')[0].toLowerCase()
  return (SUPPORTED_SPELL_LANGS as readonly string[]).includes(base) ? (base as SpellLang) : null
}

function assetUrl(path: string): string {
  // BASE_URL is '/verbalis/' on GitHub Pages, '/' in dev — same as corpora.
  const base = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`
  return `${base}${path}`
}

/** Fetch the affix + dictionary files for a language. Throws on network error. */
export async function fetchDictionary(
  lang: SpellLang,
  fetchImpl: typeof fetch = fetch,
): Promise<RawDictionary> {
  const [affResp, dicResp] = await Promise.all([
    fetchImpl(assetUrl(`dictionaries/${lang}/index.aff`)),
    fetchImpl(assetUrl(`dictionaries/${lang}/index.dic`)),
  ])
  if (!affResp.ok || !dicResp.ok) {
    throw new Error(`Dictionary "${lang}" is unavailable (offline and not yet cached).`)
  }
  const [aff, dic] = await Promise.all([affResp.text(), dicResp.text()])
  return { aff, dic }
}
