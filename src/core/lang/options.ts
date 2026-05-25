import { LANGUAGE_OPTIONS, displayLanguage } from '@/core/i18n/languages'

export interface LanguageOption {
  value: string
  label: string
}

export const LANG_OPTIONS: LanguageOption[] = LANGUAGE_OPTIONS.map((o) => ({
  value: o.code,
  label: o.label,
}))

export function getLanguageLabel(code: string): string {
  return displayLanguage(code)
}
