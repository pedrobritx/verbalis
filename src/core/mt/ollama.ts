import type { OllamaSettings } from '@/core/types'
import { MTError, type MTProvider, type TranslateResult } from './types'
import { buildSystemPrompt } from './constants'

interface OllamaChatResponse {
  message?: { content?: string }
  error?: string
}

function endpointFor(settings: OllamaSettings, path: string): string {
  const base = settings.endpoint.replace(/\/+$/, '')
  return `${base}${path}`
}

export const ollamaProvider: MTProvider<OllamaSettings> = {
  id: 'ollama',
  label: 'Ollama (local)',
  requiresNetwork: false,
  async translate(input, settings, fetchImpl = fetch) {
    const trimmed = input.text.trim()
    if (!trimmed) throw new MTError('ollama', 'invalid', 'Empty source text')

    const body = {
      model: settings.model,
      stream: false,
      messages: [
        { role: 'system', content: buildSystemPrompt(input.sourceLang, input.targetLang) },
        { role: 'user', content: trimmed },
      ],
    }

    let resp: Response
    try {
      resp = await fetchImpl(endpointFor(settings, '/api/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: input.signal,
      })
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new MTError('ollama', 'aborted', 'Request cancelled')
      }
      throw new MTError(
        'ollama',
        'network',
        `Could not reach Ollama at ${settings.endpoint}. Make sure it is running and OLLAMA_ORIGINS allows this site.`,
      )
    }

    if (!resp.ok) {
      throw new MTError('ollama', 'network', `Ollama returned ${resp.status}`)
    }

    let json: OllamaChatResponse
    try {
      json = (await resp.json()) as OllamaChatResponse
    } catch (err) {
      throw new MTError('ollama', 'parse', err instanceof Error ? err.message : 'invalid JSON')
    }

    if (json.error) throw new MTError('ollama', 'invalid', json.error)
    const text = json.message?.content?.trim()
    if (!text) throw new MTError('ollama', 'parse', 'Empty response from Ollama')

    const result: TranslateResult = {
      text,
      providerId: 'ollama',
      model: settings.model,
    }
    return result
  },
  async testConnection(settings, fetchImpl = fetch) {
    let resp: Response
    try {
      resp = await fetchImpl(endpointFor(settings, '/api/tags'), { method: 'GET' })
    } catch {
      throw new MTError(
        'ollama',
        'network',
        `Could not reach Ollama at ${settings.endpoint}. Make sure it is running and OLLAMA_ORIGINS allows this site.`,
      )
    }
    if (!resp.ok) throw new MTError('ollama', 'network', `Ollama returned ${resp.status}`)
  },
}
