// Configurable web-search providers (memoQ's web-search resource). A provider is
// just a name + URL template with {q}, {src} and {tgt} placeholders. Launching
// one opens the user's browser directly to that site — Verbalis never proxies the
// query, so nothing about it is logged here. All providers ship disabled; the
// user opts in per provider in Settings.

export interface WebSearchProvider {
  id: string
  name: string
  /** URL with {q} (query), and optional {src}/{tgt} BCP-47 language placeholders. */
  urlTemplate: string
  enabled: boolean
}

export interface WebSearchSettings {
  providers: WebSearchProvider[]
}

export const DEFAULT_WEB_SEARCH_PROVIDERS: WebSearchProvider[] = [
  { id: 'linguee', name: 'Linguee', urlTemplate: 'https://www.linguee.com/search?query={q}', enabled: false },
  { id: 'reverso', name: 'Reverso Context', urlTemplate: 'https://context.reverso.net/translation/?q={q}', enabled: false },
  { id: 'wordreference', name: 'WordReference', urlTemplate: 'https://www.wordreference.com/{src}{tgt}/{q}', enabled: false },
  { id: 'deepl', name: 'DeepL (web)', urlTemplate: 'https://www.deepl.com/translator#{src}/{tgt}/{q}', enabled: false },
  { id: 'google', name: 'Google', urlTemplate: 'https://www.google.com/search?q={q}', enabled: false },
  { id: 'scholar', name: 'Google Scholar', urlTemplate: 'https://scholar.google.com/scholar?q={q}', enabled: false },
]

export const DEFAULT_WEB_SEARCH_SETTINGS: WebSearchSettings = {
  providers: DEFAULT_WEB_SEARCH_PROVIDERS,
}

/** Build a launchable URL by substituting and URL-encoding the placeholders. */
export function buildSearchUrl(
  provider: WebSearchProvider,
  vars: { q: string; src?: string; tgt?: string },
): string {
  return provider.urlTemplate
    .replace(/\{q\}/g, encodeURIComponent(vars.q))
    .replace(/\{src\}/g, encodeURIComponent(vars.src ?? ''))
    .replace(/\{tgt\}/g, encodeURIComponent(vars.tgt ?? ''))
}
