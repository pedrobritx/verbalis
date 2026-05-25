export interface LanguageOption {
  code: string
  label: string
  base: string
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'en', label: 'English', base: 'en' },
  { code: 'en-US', label: 'English (US)', base: 'en' },
  { code: 'en-GB', label: 'English (UK)', base: 'en' },
  { code: 'es', label: 'Spanish', base: 'es' },
  { code: 'es-ES', label: 'Spanish (Spain)', base: 'es' },
  { code: 'es-419', label: 'Spanish (Latin America)', base: 'es' },
  { code: 'fr', label: 'French', base: 'fr' },
  { code: 'fr-FR', label: 'French (France)', base: 'fr' },
  { code: 'fr-CA', label: 'French (Canada)', base: 'fr' },
  { code: 'de', label: 'German', base: 'de' },
  { code: 'it', label: 'Italian', base: 'it' },
  { code: 'pt', label: 'Portuguese', base: 'pt' },
  { code: 'pt-BR', label: 'Portuguese (Brazil)', base: 'pt' },
  { code: 'pt-PT', label: 'Portuguese (Portugal)', base: 'pt' },
  { code: 'nl', label: 'Dutch', base: 'nl' },
  { code: 'pl', label: 'Polish', base: 'pl' },
  { code: 'ru', label: 'Russian', base: 'ru' },
  { code: 'ja', label: 'Japanese', base: 'ja' },
  { code: 'ko', label: 'Korean', base: 'ko' },
  { code: 'zh', label: 'Chinese', base: 'zh' },
  { code: 'zh-Hans', label: 'Chinese (Simplified)', base: 'zh' },
  { code: 'zh-Hant', label: 'Chinese (Traditional)', base: 'zh' },
  { code: 'ar', label: 'Arabic', base: 'ar' },
  { code: 'tr', label: 'Turkish', base: 'tr' },
]

const OPTIONS_BY_CODE = new Map(LANGUAGE_OPTIONS.map((o) => [o.code.toLowerCase(), o]))

export function baseLanguage(tag: string): string {
  if (!tag) return tag
  const known = OPTIONS_BY_CODE.get(tag.toLowerCase())
  if (known) return known.base
  return tag.split('-')[0].toLowerCase()
}

export function displayLanguage(tag: string): string {
  return OPTIONS_BY_CODE.get(tag.toLowerCase())?.label ?? tag
}
