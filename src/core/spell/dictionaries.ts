// On-demand loading of the bundled Hunspell dictionaries (public/dictionaries/),
// mirroring core/corpus/manifest.ts: static assets fetched relative to BASE_URL,
// cached by the service worker (a runtimeCaching rule), never bundled into JS.

export interface RawDictionary {
  aff: string
  dic: string
}

/**
 * Dictionary keys we ship under public/dictionaries/<key>/. `en` is American and
 * `pt` is Brazilian (the wooorm defaults); `en-GB`/`pt-PT` are the regional
 * variants so British/European targets spell-check correctly instead of falling
 * back to the wrong variant.
 */
export const SUPPORTED_SPELL_LANGS = ['en', 'en-GB', 'pt', 'pt-PT'] as const
export type SpellLang = (typeof SUPPORTED_SPELL_LANGS)[number]

/**
 * Map a project's BCP-47 target language to the best shipped dictionary. Exact
 * variants resolve to their own dictionary; a bare base language resolves to the
 * shipped default for that language (en→American, pt→Brazilian). Anything we
 * don't bundle returns null (spell-check stays off).
 */
const VARIANT_TO_DICT: Record<string, SpellLang> = {
  en: 'en',
  'en-us': 'en',
  'en-gb': 'en-GB',
  pt: 'pt',
  'pt-br': 'pt',
  'pt-pt': 'pt-PT',
}

export function resolveSpellLang(targetLang: string | undefined): SpellLang | null {
  const tag = (targetLang ?? '').toLowerCase()
  if (tag in VARIANT_TO_DICT) return VARIANT_TO_DICT[tag]
  const base = tag.split('-')[0]
  return base in VARIANT_TO_DICT ? VARIANT_TO_DICT[base] : null
}

function assetUrl(path: string): string {
  // BASE_URL follows the configured Vite base — same as corpora.
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
