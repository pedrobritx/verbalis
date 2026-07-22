import { describe, expect, it, vi } from 'vitest'
import {
  listDriveFiles,
  downloadDriveFile,
  uploadDriveFile,
} from '@/extensions/connectors/gdrive/driveApi'
import { ConnectorError } from '@/extensions/connectors/types'

function jsonOk(body: unknown) {
  return { ok: true, status: 200, json: async () => body }
}

describe('driveApi.listDriveFiles', () => {
  it('sends a Bearer token, excludes folders/trashed, and maps files', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      jsonOk({
        files: [
          {
            id: 'a',
            name: 'doc.docx',
            mimeType: 'application/vnd...',
            modifiedTime: '2026-07-20T00:00:00Z',
            size: '1234',
          },
          { id: 'b', name: 'notes.txt' },
        ],
      }),
    )
    const files = await listDriveFiles('tok-123', {}, fetchImpl as unknown as typeof fetch)

    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toContain('https://www.googleapis.com/drive/v3/files?')
    expect(url).toContain('trashed+%3D+false')
    expect(url).toContain('mimeType+%21%3D')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok-123')

    expect(files).toEqual([
      {
        id: 'a',
        name: 'doc.docx',
        mimeType: 'application/vnd...',
        modifiedTime: '2026-07-20T00:00:00Z',
        sizeBytes: 1234,
      },
      { id: 'b', name: 'notes.txt' },
    ])
  })

  it('adds a name-contains clause when a query is given', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonOk({ files: [] }))
    await listDriveFiles('t', { query: 'report' }, fetchImpl as unknown as typeof fetch)
    expect(fetchImpl.mock.calls[0][0]).toContain('name+contains')
  })

  it('maps a 401 to an auth ConnectorError', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Invalid Credentials' } }),
    })
    await expect(
      listDriveFiles('bad', {}, fetchImpl as unknown as typeof fetch),
    ).rejects.toMatchObject({
      name: 'ConnectorError',
      code: 'auth',
      message: 'Invalid Credentials',
    })
  })

  it('maps a 429 to rate_limit', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) })
    await expect(
      listDriveFiles('t', {}, fetchImpl as unknown as typeof fetch),
    ).rejects.toMatchObject({
      code: 'rate_limit',
    })
  })
})

describe('driveApi.downloadDriveFile', () => {
  it('requests alt=media with the token and returns the bytes', async () => {
    const bytes = new TextEncoder().encode('hello').buffer
    const fetchImpl = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      arrayBuffer: async () => bytes,
    })
    const out = await downloadDriveFile('tok', 'file 1', fetchImpl as unknown as typeof fetch)

    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://www.googleapis.com/drive/v3/files/file%201?alt=media')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok')
    expect(new TextDecoder().decode(out)).toBe('hello')
  })
})

describe('driveApi.uploadDriveFile', () => {
  it('POSTs a multipart/related body with metadata + media and returns the file', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonOk({ id: 'new1', name: 'out.docx', mimeType: 'application/x-docx' }),
      )
    const bytes = new TextEncoder().encode('DOCXBYTES')
    const created = await uploadDriveFile(
      'tok',
      { name: 'out.docx', mimeType: 'application/x-docx', bytes },
      fetchImpl as unknown as typeof fetch,
    )

    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toContain('https://www.googleapis.com/upload/drive/v3/files?')
    expect(url).toContain('uploadType=multipart')
    expect(init.method).toBe('POST')
    const headers = init.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer tok')
    expect(headers['Content-Type']).toMatch(/^multipart\/related; boundary=verbalis-/)

    const bodyText = await (init.body as Blob).text()
    expect(bodyText).toContain('"name":"out.docx"')
    expect(bodyText).toContain('"mimeType":"application/x-docx"')
    expect(bodyText).toContain('DOCXBYTES')

    expect(created).toEqual({ id: 'new1', name: 'out.docx', mimeType: 'application/x-docx' })
  })

  it('wraps a network throw as a ConnectorError', async () => {
    const fetchImpl = vi.fn().mockRejectedValueOnce(new Error('offline'))
    const err = await uploadDriveFile(
      'tok',
      { name: 'x', mimeType: 'text/plain', bytes: new Uint8Array() },
      fetchImpl as unknown as typeof fetch,
    ).catch((e) => e)
    expect(err).toBeInstanceOf(ConnectorError)
    expect((err as ConnectorError).code).toBe('network')
  })
})
