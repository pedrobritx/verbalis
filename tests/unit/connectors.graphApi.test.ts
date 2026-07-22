import { describe, expect, it, vi } from 'vitest'
import {
  listOnedriveFiles,
  downloadOnedriveFile,
  uploadOnedriveFile,
} from '@/extensions/connectors/onedrive/graphApi'
import { ConnectorError } from '@/extensions/connectors/types'

function jsonOk(body: unknown) {
  return { ok: true, status: 200, json: async () => body }
}

describe('graphApi.listOnedriveFiles', () => {
  it('lists root children with a Bearer token, mapping files and skipping folders', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      jsonOk({
        value: [
          {
            id: 'a',
            name: 'doc.docx',
            size: 1234,
            lastModifiedDateTime: '2026-07-20T00:00:00Z',
            file: { mimeType: 'application/x-docx' },
          },
          { id: 'f', name: 'Folder', folder: { childCount: 2 } },
          { id: 'b', name: 'notes.txt', file: {} },
        ],
      }),
    )
    const files = await listOnedriveFiles('tok-1', {}, fetchImpl as unknown as typeof fetch)

    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe(
      'https://graph.microsoft.com/v1.0/me/drive/root/children?$top=50&$orderby=lastModifiedDateTime%20desc&$select=id,name,size,file,folder,lastModifiedDateTime',
    )
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok-1')

    // Folder skipped; files mapped.
    expect(files).toEqual([
      {
        id: 'a',
        name: 'doc.docx',
        mimeType: 'application/x-docx',
        modifiedTime: '2026-07-20T00:00:00Z',
        sizeBytes: 1234,
      },
      { id: 'b', name: 'notes.txt' },
    ])
  })

  it('uses the search endpoint when a query is given', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonOk({ value: [] }))
    await listOnedriveFiles('t', { query: "o'brien" }, fetchImpl as unknown as typeof fetch)
    expect(fetchImpl.mock.calls[0][0]).toContain("/me/drive/root/search(q='o''brien')")
  })

  it('maps a 401 to an auth ConnectorError', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'InvalidAuthenticationToken' } }),
    })
    await expect(
      listOnedriveFiles('bad', {}, fetchImpl as unknown as typeof fetch),
    ).rejects.toMatchObject({
      name: 'ConnectorError',
      code: 'auth',
      message: 'InvalidAuthenticationToken',
    })
  })
})

describe('graphApi.downloadOnedriveFile', () => {
  it('GETs the item content with the token and returns the bytes', async () => {
    const bytes = new TextEncoder().encode('hello').buffer
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, arrayBuffer: async () => bytes })
    const out = await downloadOnedriveFile('tok', 'item 1', fetchImpl as unknown as typeof fetch)

    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://graph.microsoft.com/v1.0/me/drive/items/item%201/content')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok')
    expect(new TextDecoder().decode(out)).toBe('hello')
  })
})

describe('graphApi.uploadOnedriveFile', () => {
  it('PUTs the bytes to the root path and returns the created item', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonOk({ id: 'new1', name: 'out.docx', file: { mimeType: 'application/x-docx' } }),
      )
    const bytes = new TextEncoder().encode('DOCXBYTES')
    const created = await uploadOnedriveFile(
      'tok',
      { name: 'out.docx', mimeType: 'application/x-docx', bytes },
      fetchImpl as unknown as typeof fetch,
    )

    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://graph.microsoft.com/v1.0/me/drive/root:/out.docx:/content')
    expect(init.method).toBe('PUT')
    const headers = init.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer tok')
    expect(headers['Content-Type']).toBe('application/x-docx')
    expect(await (init.body as Blob).text()).toBe('DOCXBYTES')

    expect(created).toEqual({ id: 'new1', name: 'out.docx', mimeType: 'application/x-docx' })
  })

  it('wraps a network throw as a ConnectorError', async () => {
    const fetchImpl = vi.fn().mockRejectedValueOnce(new Error('offline'))
    const err = await uploadOnedriveFile(
      'tok',
      { name: 'x', mimeType: 'text/plain', bytes: new Uint8Array() },
      fetchImpl as unknown as typeof fetch,
    ).catch((e) => e)
    expect(err).toBeInstanceOf(ConnectorError)
    expect((err as ConnectorError).code).toBe('network')
  })
})
