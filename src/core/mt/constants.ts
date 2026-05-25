import { displayLanguage } from '@/core/i18n/languages'

export function buildSystemPrompt(sourceLang: string, targetLang: string): string {
  const src = displayLanguage(sourceLang)
  const tgt = displayLanguage(targetLang)
  return `You are a professional translator. Translate the user message from ${src} (${sourceLang}) to ${tgt} (${targetLang}). Preserve the regional variant of the target language exactly. Respond with the translation only, no commentary, no quotes, no prefix.`
}

export const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages'
export const CLAUDE_API_VERSION = '2023-06-01'
export const CLAUDE_MAX_TOKENS = 4096
