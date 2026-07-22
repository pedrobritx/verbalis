import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createOnedriveConnector } from '@/extensions/connectors/onedrive'
import {
  CONNECTOR_ONEDRIVE_ID,
  isOnedriveConfigured,
  isOnedriveAvailable,
} from '@/extensions/connectors/onedrive/config'
import { extensionRegistry } from '@/core/extensions/registry'
import { registerBuiltinExtensions, __resetBuiltinsForTest } from '@/core/extensions/builtins'

function jsonOk(body: unknown) {
  return { ok: true, status: 200, json: async () => body }
}

describe('onedrive config gating', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('isOnedriveConfigured follows VITE_MS_CLIENT_ID', () => {
    vi.stubEnv('VITE_MS_CLIENT_ID', '')
    expect(isOnedriveConfigured()).toBe(false)
    vi.stubEnv('VITE_MS_CLIENT_ID', '00000000-0000-0000-0000-000000000000')
    expect(isOnedriveConfigured()).toBe(true)
  })

  it('registers as a storage-connector manifest alongside gdrive', () => {
    extensionRegistry.__resetForTest()
    __resetBuiltinsForTest()
    registerBuiltinExtensions()
    const ids = extensionRegistry.list('storage-connector').map((m) => m.id)
    expect(ids).toContain(CONNECTOR_ONEDRIVE_ID)
    expect(ids).toContain('connector.gdrive')
    expect(extensionRegistry.get(CONNECTOR_ONEDRIVE_ID)?.permissions).toContain('credentials')
  })

  it('isOnedriveAvailable ANDs config with the registry enablement', () => {
    extensionRegistry.__resetForTest()
    __resetBuiltinsForTest()
    registerBuiltinExtensions()

    vi.stubEnv('VITE_MS_CLIENT_ID', '')
    expect(isOnedriveAvailable()).toBe(false)

    vi.stubEnv('VITE_MS_CLIENT_ID', 'client-id')
    expect(isOnedriveAvailable()).toBe(true)

    extensionRegistry.setEnabled(CONNECTOR_ONEDRIVE_ID, false)
    expect(isOnedriveAvailable()).toBe(false)
  })
})

describe('createOnedriveConnector', () => {
  beforeEach(() => {
    extensionRegistry.__resetForTest()
    __resetBuiltinsForTest()
    registerBuiltinExtensions()
  })

  it('lists files through an injected token + fetch', async () => {
    const getToken = vi.fn().mockResolvedValue('tok-x')
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonOk({ value: [{ id: '1', name: 'a.txt', file: {} }] }))
    const c = createOnedriveConnector({ getToken, fetchImpl: fetchImpl as unknown as typeof fetch })

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
    const c = createOnedriveConnector({ getToken, fetchImpl: fetchImpl as unknown as typeof fetch })

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
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonOk({ id: 'up1', name: 'x.docx', file: {} }))
    const c = createOnedriveConnector({ getToken, fetchImpl: fetchImpl as unknown as typeof fetch })

    const created = await c.uploadFile({
      name: 'x.docx',
      mimeType: 'application/x-docx',
      bytes: new Uint8Array([1, 2]),
    })
    expect(created).toEqual({ id: 'up1', name: 'x.docx' })
    expect(fetchImpl.mock.calls[0][1].method).toBe('PUT')
  })
})
