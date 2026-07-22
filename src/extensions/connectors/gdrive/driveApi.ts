import { ConnectorError, type ConnectorFile, type ListFilesOptions } from '../types'
import { CONNECTOR_GDRIVE_ID } from './config'

/**
 * Pure Google Drive REST layer (Phase 6.3). No GIS / no DOM — every call takes
 * an OAuth access token and an injectable `fetchImpl`, mirroring the `fetchImpl`
 * seam in `src/core/mt/*` so vitest never hits the network. The `drive.file`
 * scope only exposes files the app created or the user explicitly opened, which
 * avoids Google's restricted-scope verification burden (ROADMAP §6.3).
 */

const FILES_URL = 'https://www.googleapis.com/drive/v3/files'
const UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files'
const FILE_FIELDS = 'id,name,mimeType,modifiedTime,size'

interface DriveFileResource {
  id: string
  name: string
  mimeType?: string
  modifiedTime?: string
  size?: string
}

function codeForStatus(status: number): 'auth' | 'rate_limit' | 'invalid' | 'network' {
  if (status === 401 || status === 403) return 'auth'
  if (status === 429) return 'rate_limit'
  if (status === 400 || status === 404) return 'invalid'
  return 'network'
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` }
}

async function driveError(resp: Response): Promise<ConnectorError> {
  let detail = `Drive request failed (${resp.status})`
  try {
    const body = (await resp.json()) as { error?: { message?: string } }
    if (body?.error?.message) detail = body.error.message
  } catch {
    // non-JSON error body; keep the status-based message
  }
  return new ConnectorError(CONNECTOR_GDRIVE_ID, codeForStatus(resp.status), detail)
}

function mapFile(f: DriveFileResource): ConnectorFile {
  return {
    id: f.id,
    name: f.name,
    ...(f.mimeType ? { mimeType: f.mimeType } : {}),
    ...(f.modifiedTime ? { modifiedTime: f.modifiedTime } : {}),
    ...(f.size ? { sizeBytes: Number(f.size) } : {}),
  }
}

/** List non-trashed Drive files, newest first. `options.query` narrows by name. */
export async function listDriveFiles(
  token: string,
  options: ListFilesOptions = {},
  fetchImpl: typeof fetch = fetch,
): Promise<ConnectorFile[]> {
  const q = ['trashed = false', "mimeType != 'application/vnd.google-apps.folder'"]
  if (options.query?.trim()) {
    q.push(`name contains '${options.query.trim().replace(/'/g, "\\'")}'`)
  }
  const params = new URLSearchParams({
    q: q.join(' and '),
    fields: `files(${FILE_FIELDS})`,
    orderBy: 'modifiedTime desc',
    pageSize: String(options.limit ?? 50),
    spaces: 'drive',
  })
  let resp: Response
  try {
    resp = await fetchImpl(`${FILES_URL}?${params.toString()}`, { headers: authHeaders(token) })
  } catch (err) {
    throw new ConnectorError(
      CONNECTOR_GDRIVE_ID,
      'network',
      err instanceof Error ? err.message : 'fetch failed',
    )
  }
  if (!resp.ok) throw await driveError(resp)
  const body = (await resp.json()) as { files?: DriveFileResource[] }
  return (body.files ?? []).map(mapFile)
}

/** Download a file's raw bytes (`alt=media`). */
export async function downloadDriveFile(
  token: string,
  fileId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ArrayBuffer> {
  const params = new URLSearchParams({ alt: 'media' })
  let resp: Response
  try {
    resp = await fetchImpl(`${FILES_URL}/${encodeURIComponent(fileId)}?${params.toString()}`, {
      headers: authHeaders(token),
    })
  } catch (err) {
    throw new ConnectorError(
      CONNECTOR_GDRIVE_ID,
      'network',
      err instanceof Error ? err.message : 'fetch failed',
    )
  }
  if (!resp.ok) throw await driveError(resp)
  return resp.arrayBuffer()
}

/** Upload bytes as a new Drive file via a multipart/related request. */
export async function uploadDriveFile(
  token: string,
  input: { name: string; mimeType: string; bytes: ArrayBuffer | Uint8Array },
  fetchImpl: typeof fetch = fetch,
): Promise<ConnectorFile> {
  const boundary = `verbalis-${Math.random().toString(36).slice(2)}`
  const metadata = JSON.stringify({ name: input.name, mimeType: input.mimeType })
  // Blob's typings insist on an ArrayBuffer-backed view; a plain Blob wrapper of
  // the bytes sidesteps the SharedArrayBuffer generic without copying semantics.
  const media = new Blob([input.bytes as BlobPart])
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
    metadata,
    `\r\n--${boundary}\r\nContent-Type: ${input.mimeType}\r\n\r\n`,
    media,
    `\r\n--${boundary}--`,
  ])
  const params = new URLSearchParams({ uploadType: 'multipart', fields: FILE_FIELDS })
  let resp: Response
  try {
    resp = await fetchImpl(`${UPLOAD_URL}?${params.toString()}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    })
  } catch (err) {
    throw new ConnectorError(
      CONNECTOR_GDRIVE_ID,
      'network',
      err instanceof Error ? err.message : 'fetch failed',
    )
  }
  if (!resp.ok) throw await driveError(resp)
  return mapFile((await resp.json()) as DriveFileResource)
}
