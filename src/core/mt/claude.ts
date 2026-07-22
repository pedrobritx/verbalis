import type { ClaudeSettings } from '@/core/types'
import { MTError, type MTProvider, type TranslateInput, type TranslateResult } from './types'
import {
  buildSystemPrompt,
  CLAUDE_API_URL,
  CLAUDE_API_VERSION,
  CLAUDE_MAX_TOKENS,
} from './constants'

interface ClaudeContentBlock {
  type: string
  text?: string
}
interface ClaudeResponse {
  content?: ClaudeContentBlock[]
  error?: { type?: string; message?: string }
}

function headers(apiKey: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': CLAUDE_API_VERSION,
    'anthropic-dangerous-direct-browser-access': 'true',
  }
}

function codeForStatus(status: number): 'auth' | 'rate_limit' | 'invalid' | 'network' {
  if (status === 401 || status === 403) return 'auth'
  if (status === 429) return 'rate_limit'
  if (status === 400) return 'invalid'
  return 'network'
}

export const claudeProvider: MTProvider<ClaudeSettings> = {
  id: 'claude',
  label: 'Claude API',
  requiresNetwork: true,
  async translate(input: TranslateInput, settings: ClaudeSettings, fetchImpl = fetch) {
    const trimmed = input.text.trim()
    if (!trimmed) throw new MTError('claude', 'invalid', 'Empty source text')
    if (!settings.apiKey) throw new MTError('claude', 'auth', 'Claude API key missing')

    const body = {
      model: settings.model,
      max_tokens: CLAUDE_MAX_TOKENS,
      system: buildSystemPrompt(input.sourceLang, input.targetLang),
      messages: [{ role: 'user', content: trimmed }],
    }

    let resp: Response
    try {
      resp = await fetchImpl(CLAUDE_API_URL, {
        method: 'POST',
        headers: headers(settings.apiKey),
        body: JSON.stringify(body),
        signal: input.signal,
      })
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new MTError('claude', 'aborted', 'Request cancelled')
      }
      throw new MTError('claude', 'network', err instanceof Error ? err.message : 'fetch failed')
    }

    let json: ClaudeResponse | null = null
    try {
      json = (await resp.json()) as ClaudeResponse
    } catch {
      // fall through to status check
    }

    if (!resp.ok) {
      const code = codeForStatus(resp.status)
      const msg = json?.error?.message ?? `Claude API returned ${resp.status}`
      throw new MTError('claude', code, msg)
    }
    if (!json) throw new MTError('claude', 'parse', 'invalid JSON')

    const text = json.content
      ?.filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('')
      .trim()
    if (!text) throw new MTError('claude', 'parse', 'Empty response from Claude')

    const result: TranslateResult = { text, providerId: 'claude', model: settings.model }
    return result
  },
  async testConnection(settings, fetchImpl = fetch) {
    // A minimal-cost ping: ask for max_tokens=1 with a single token of input.
    if (!settings.apiKey) throw new MTError('claude', 'auth', 'Claude API key missing')
    const body = {
      model: settings.model,
      max_tokens: 1,
      messages: [{ role: 'user', content: 'hi' }],
    }
    let resp: Response
    try {
      resp = await fetchImpl(CLAUDE_API_URL, {
        method: 'POST',
        headers: headers(settings.apiKey),
        body: JSON.stringify(body),
      })
    } catch (err) {
      throw new MTError('claude', 'network', err instanceof Error ? err.message : 'fetch failed')
    }
    if (!resp.ok) {
      const code = codeForStatus(resp.status)
      throw new MTError('claude', code, `Claude API returned ${resp.status}`)
    }
  },
}
