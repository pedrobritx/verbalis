import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createGdriveConnector } from '@/extensions/connectors/gdrive'
import {
  CONNECTOR_GDRIVE_ID,
  isGdriveConfigured,
  isGdriveAvailable,
} from '@/extensions/connectors/gdrive/config'
import { extensionRegistry } from '@/core/extensions/registry'
import { registerBuiltinExtensions, __resetBuiltinsForTest } from '@/core/extensions/builtins'

function jsonOk(body: unknown) {
  return { ok: true, status: 200, json: async () => body }
}

describe('gdrive config gating', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('isGdriveConfigured follows VITE_GOOGLE_CLIENT_ID', () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '')
    expect(isGdriveConfigured()).toBe(false)
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'abc.apps.googleusercontent.com')
    expect(isGdriveConfigured()).toBe(true)
  })

  it('registers as a storage-connector manifest', () => {
    extensionRegistry.__resetForTest()
    __resetBuiltinsForTest()
    registerBuiltinExtensions()
    const ids = extensionRegistry.list('storage-connector').map((m) => m.id)
    expect(ids).toContain(CONNECTOR_GDRIVE_ID)
    expect(extensionRegistry.get(CONNECTOR_GDRIVE_ID)?.permissions).toContain('credentials')
  })

  it('isGdriveAvailable ANDs config with the registry enablement', () => {
    extensionRegistry.__resetForTest()
    __resetBuiltinsForTest()
    registerBuiltinExtensions()

    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '')
    expect(isGdriveAvailable()).toBe(false) // unconfigured

    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'id.apps.googleusercontent.com')
    expect(isGdriveAvailable()).toBe(true) // configured + enabled by default

    extensionRegistry.setEnabled(CONNECTOR_GDRIVE_ID, false)
    expect(isGdriveAvailable()).toBe(false) // configured but disabled
  })
})

describe('createGdriveConnector', () => {
  beforeEach(() => {
    extensionRegistry.__resetForTest()
    __resetBuiltinsForTest()
    registerBuiltinExtensions()
  })

  it('lists files through an injected token + fetch', async () => {
    const getToken = vi.fn().mockResolvedValue('tok-x')
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonOk({ files: [{ id: '1', name: 'a.txt' }] }))
    const c = createGdriveConnector({ getToken, fetchImpl: fetchImpl as unknown as typeof fetch })

    const files = await c.listFiles()
    expect(getToken).toHaveBeenCalled()
    expect(files).toEqual([{ id: '1', name: 'a.txt' }])
    expect((fetchImpl.mock.calls[0][1].headers as Record<string, string>).Authorization).toBe(
      'Bearer tok-x',
    )
  })

  it('downloads a file into a named File with its mime type', async () => {
    const getToken = vi.fn().mockResolvedValue('tok')
    const bytes = new TextEncoder().encode('body').buffer
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, arrayBuffer: async () => bytes })
    const c = createGdriveConnector({ getToken, fetchImpl: fetchImpl as unknown as typeof fetch })

    const file = await c.downloadFile({
      id: '9',
      name: 'report.docx',
      mimeType: 'application/x-docx',
    })
    expect(file).toBeInstanceOf(File)
    expect(file.name).toBe('report.docx')
    expect(file.type).toBe('application/x-docx')
    expect(await file.text()).toBe('body')
  })

  it('uploads bytes and returns the created file', async () => {
    const getToken = vi.fn().mockResolvedValue('tok')
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonOk({ id: 'up1', name: 'x.docx' }))
    const c = createGdriveConnector({ getToken, fetchImpl: fetchImpl as unknown as typeof fetch })

    const created = await c.uploadFile({
      name: 'x.docx',
      mimeType: 'application/x-docx',
      bytes: new Uint8Array([1, 2]),
    })
    expect(created).toEqual({ id: 'up1', name: 'x.docx' })
    expect(fetchImpl.mock.calls[0][1].method).toBe('POST')
  })
})
