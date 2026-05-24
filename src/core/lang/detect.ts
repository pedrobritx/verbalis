import { detectAll } from 'tinyld'

export interface DetectedLanguage {
  lang: string
  confidence: number
}

const UNKNOWN: DetectedLanguage = { lang: 'und', confidence: 0 }

export function detectLanguage(text: string): DetectedLanguage {
  const trimmed = text.trim()
  if (trimmed.length < 4) return UNKNOWN
  const candidates = detectAll(trimmed)
  const top = candidates[0]
  if (!top) return UNKNOWN
  return { lang: top.lang, confidence: top.accuracy }
}
