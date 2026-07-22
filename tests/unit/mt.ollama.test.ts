import { describe, expect, it, vi } from 'vitest'
import { ollamaProvider } from '@/core/mt/ollama'
import type { OllamaSettings } from '@/core/types'

const settings: OllamaSettings = {
  enabled: true,
  endpoint: 'http://localhost:11434',
  model: 'llama3.1',
}

function okResponse(content: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ message: { content } }),
  }
}

describe('ollamaProvider.translate', () => {
  it('parses content from /api/chat', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(okResponse('Hola mundo'))
    const result = await ollamaProvider.translate(
      { text: 'Hello world', sourceLang: 'en', targetLang: 'es' },
      settings,
      fetchImpl as unknown as typeof fetch,
    )
    expect(result.text).toBe('Hola mundo')
    expect(result.providerId).toBe('ollama')
    expect(result.model).toBe('llama3.1')
  })

  it('sends model + system prompt + user message', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(okResponse('x'))
    await ollamaProvider.translate(
      { text: 'Hi', sourceLang: 'en', targetLang: 'fr' },
      settings,
      fetchImpl as unknown as typeof fetch,
    )
    const [, init] = fetchImpl.mock.calls[0]
    const body = JSON.parse(init.body)
    expect(body.model).toBe('llama3.1')
    expect(body.stream).toBe(false)
    expect(body.messages).toHaveLength(2)
    expect(body.messages[0].role).toBe('system')
    expect(body.messages[0].content).toMatch(/from English \(en\) to French \(fr\)/)
    expect(body.messages[1].content).toBe('Hi')
  })

  it('throws invalid on empty source', async () => {
    await expect(
      ollamaProvider.translate({ text: '   ', sourceLang: 'en', targetLang: 'es' }, settings),
    ).rejects.toMatchObject({ code: 'invalid' })
  })

  it('maps fetch rejection to network with OLLAMA_ORIGINS hint', async () => {
    const fetchImpl = vi.fn().mockRejectedValueOnce(new Error('fail'))
    await expect(
      ollamaProvider.translate(
        { text: 'hi', sourceLang: 'en', targetLang: 'es' },
        settings,
        fetchImpl as unknown as typeof fetch,
      ),
    ).rejects.toMatchObject({ code: 'network', message: expect.stringMatching(/OLLAMA_ORIGINS/) })
  })

  it('returns aborted on AbortError', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('aborted'), { name: 'AbortError' }))
    await expect(
      ollamaProvider.translate(
        { text: 'hi', sourceLang: 'en', targetLang: 'es' },
        settings,
        fetchImpl as unknown as typeof fetch,
      ),
    ).rejects.toMatchObject({ code: 'aborted' })
  })

  it('throws parse on empty content', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ message: { content: '   ' } }),
    })
    await expect(
      ollamaProvider.translate(
        { text: 'hi', sourceLang: 'en', targetLang: 'es' },
        settings,
        fetchImpl as unknown as typeof fetch,
      ),
    ).rejects.toMatchObject({ code: 'parse' })
  })

  it('throws network on non-OK status', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
    await expect(
      ollamaProvider.translate(
        { text: 'hi', sourceLang: 'en', targetLang: 'es' },
        settings,
        fetchImpl as unknown as typeof fetch,
      ),
    ).rejects.toMatchObject({ code: 'network' })
  })
})
