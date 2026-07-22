import type { MyMemorySettings } from '@/core/types'
import { MTError, type MTProvider, type TranslateInput, type TranslateResult } from './types'

// MyMemory is a free CORS-friendly GET API. Anonymous quota is ~5k chars/day;
// passing a contact email via `de` raises it to ~50k. The single-request limit
// is 500 characters of source text.
const MAX_CHARS = 500

interface MyMemoryResponse {
  responseData?: { translatedText?: string; match?: number }
  responseStatus?: number | string
  responseDetails?: string
}

function codeForStatus(status: number): 'auth' | 'rate_limit' | 'network' {
  if (status === 401 || status === 403) return 'auth'
  if (status === 429) return 'rate_limit'
  return 'network'
}

function buildUrl(endpoint: string, input: TranslateInput, email?: string): string {
  const url = new URL(endpoint)
  url.searchParams.set('q', input.text.trim())
  url.searchParams.set('langpair', `${input.sourceLang}|${input.targetLang}`)
  if (email) url.searchParams.set('de', email)
  return url.toString()
}

export const myMemoryProvider: MTProvider<MyMemorySettings> = {
  id: 'mymemory',
  label: 'MyMemory (free)',
  requiresNetwork: true,
  async translate(input: TranslateInput, settings: MyMemorySettings, fetchImpl = fetch) {
    const trimmed = input.text.trim()
    if (!trimmed) throw new MTError('mymemory', 'invalid', 'Empty source text')
    if (trimmed.length > MAX_CHARS) {
      throw new MTError(
        'mymemory',
        'invalid',
        `MyMemory limits each request to ${MAX_CHARS} characters (got ${trimmed.length}).`,
      )
    }

    let resp: Response
    try {
      resp = await fetchImpl(buildUrl(settings.endpoint, input, settings.email), {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: input.signal,
      })
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new MTError('mymemory', 'aborted', 'Request cancelled')
      }
      throw new MTError('mymemory', 'network', err instanceof Error ? err.message : 'fetch failed')
    }

    let json: MyMemoryResponse | null = null
    try {
      json = (await resp.json()) as MyMemoryResponse
    } catch {
      // fall through
    }

    if (!resp.ok) {
      throw new MTError('mymemory', codeForStatus(resp.status), `MyMemory returned ${resp.status}`)
    }

    const status =
      typeof json?.responseStatus === 'string'
        ? Number.parseInt(json.responseStatus, 10)
        : json?.responseStatus
    if (status && status !== 200) {
      const detail = json?.responseDetails || `MyMemory responded with status ${status}`
      const lower = detail.toLowerCase()
      // Inspect the message first: MyMemory returns 403 for unsupported
      // language pairs and 429-ish bodies for quota issues, so the message
      // is more reliable than the status code alone.
      const code =
        lower.includes('language') || lower.includes('pair')
          ? 'unsupported_lang'
          : lower.includes('quota') || lower.includes('limit') || status === 429
            ? 'rate_limit'
            : status === 403 || status === 401
              ? 'auth'
              : 'network'
      throw new MTError('mymemory', code, detail)
    }

    const translated = json?.responseData?.translatedText?.trim()
    if (!translated) {
      throw new MTError('mymemory', 'parse', 'Empty response from MyMemory')
    }

    const result: TranslateResult = {
      text: translated,
      providerId: 'mymemory',
    }
    return result
  },
  async testConnection(settings, fetchImpl = fetch) {
    let resp: Response
    try {
      resp = await fetchImpl(
        buildUrl(
          settings.endpoint,
          { text: 'hi', sourceLang: 'en', targetLang: 'es' },
          settings.email,
        ),
        { method: 'GET', headers: { Accept: 'application/json' } },
      )
    } catch (err) {
      throw new MTError('mymemory', 'network', err instanceof Error ? err.message : 'fetch failed')
    }
    if (!resp.ok) {
      throw new MTError('mymemory', codeForStatus(resp.status), `MyMemory returned ${resp.status}`)
    }
  },
}
