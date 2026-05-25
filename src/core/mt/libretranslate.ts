import type { LibreTranslateSettings } from '@/core/types'
import { baseLanguage } from '@/core/i18n/languages'
import { MTError, type MTProvider, type TranslateInput, type TranslateResult } from './types'

interface LibreResponse {
  translatedText?: string
  error?: string
}

function codeForStatus(status: number): 'auth' | 'rate_limit' | 'network' {
  if (status === 401 || status === 403) return 'auth'
  if (status === 429) return 'rate_limit'
  return 'network'
}

export const libreTranslateProvider: MTProvider<LibreTranslateSettings> = {
  id: 'libretranslate',
  label: 'LibreTranslate',
  requiresNetwork: true,
  async translate(input: TranslateInput, settings: LibreTranslateSettings, fetchImpl = fetch) {
    const trimmed = input.text.trim()
    if (!trimmed) throw new MTError('libretranslate', 'invalid', 'Empty source text')

    const body: Record<string, string> = {
      q: trimmed,
      source: baseLanguage(input.sourceLang),
      target: baseLanguage(input.targetLang),
      format: 'text',
    }
    if (settings.apiKey) body.api_key = settings.apiKey

    let resp: Response
    try {
      resp = await fetchImpl(settings.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: input.signal,
      })
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new MTError('libretranslate', 'aborted', 'Request cancelled')
      }
      throw new MTError(
        'libretranslate',
        'network',
        err instanceof Error ? err.message : 'fetch failed',
      )
    }

    let json: LibreResponse | null = null
    try {
      json = (await resp.json()) as LibreResponse
    } catch {
      // fall through
    }

    if (!resp.ok) {
      const status = resp.status
      const code = status === 400 ? 'unsupported_lang' : codeForStatus(status)
      const msg = json?.error ?? `LibreTranslate returned ${status}`
      throw new MTError('libretranslate', code, msg)
    }
    if (!json?.translatedText) {
      throw new MTError('libretranslate', 'parse', 'Empty response from LibreTranslate')
    }

    const result: TranslateResult = {
      text: json.translatedText.trim(),
      providerId: 'libretranslate',
    }
    return result
  },
  async testConnection(settings, fetchImpl = fetch) {
    let resp: Response
    try {
      resp = await fetchImpl(settings.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: 'hi',
          source: 'en',
          target: 'es',
          format: 'text',
          ...(settings.apiKey ? { api_key: settings.apiKey } : {}),
        }),
      })
    } catch (err) {
      throw new MTError(
        'libretranslate',
        'network',
        err instanceof Error ? err.message : 'fetch failed',
      )
    }
    if (!resp.ok) {
      const code = resp.status === 400 ? 'invalid' : codeForStatus(resp.status)
      throw new MTError('libretranslate', code, `LibreTranslate returned ${resp.status}`)
    }
  },
}
