import { ConnectorError, type ConnectorFile, type ListFilesOptions } from '../types'
import { CONNECTOR_ONEDRIVE_ID } from './config'

/**
 * Pure Microsoft Graph REST layer for OneDrive (Phase 6.4). No MSAL / no DOM —
 * every call takes a Graph access token and an injectable `fetchImpl`, mirroring
 * the Google Drive `driveApi` and the `fetchImpl` seam in `src/core/mt/*`, so
 * vitest never hits the network. Scope: `Files.ReadWrite` (per-user OneDrive).
 */

const GRAPH = 'https://graph.microsoft.com/v1.0'
const SELECT = 'id,name,size,file,folder,lastModifiedDateTime'

interface GraphDriveItem {
  id: string
  name: string
  size?: number
  lastModifiedDateTime?: string
  file?: { mimeType?: string }
  folder?: unknown
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

async function graphError(resp: Response): Promise<ConnectorError> {
  let detail = `OneDrive request failed (${resp.status})`
  try {
    const body = (await resp.json()) as { error?: { message?: string } }
    if (body?.error?.message) detail = body.error.message
  } catch {
    // non-JSON error body; keep the status-based message
  }
  return new ConnectorError(CONNECTOR_ONEDRIVE_ID, codeForStatus(resp.status), detail)
}

/** Map a Graph DriveItem to a ConnectorFile (files only; folders are skipped upstream). */
function mapItem(it: GraphDriveItem): ConnectorFile {
  return {
    id: it.id,
    name: it.name,
    ...(it.file?.mimeType ? { mimeType: it.file.mimeType } : {}),
    ...(it.lastModifiedDateTime ? { modifiedTime: it.lastModifiedDateTime } : {}),
    ...(typeof it.size === 'number' ? { sizeBytes: it.size } : {}),
  }
}

/** List files in the user's OneDrive root (or search across the drive). Folders excluded. */
export async function listOnedriveFiles(
  token: string,
  options: ListFilesOptions = {},
  fetchImpl: typeof fetch = fetch,
): Promise<ConnectorFile[]> {
  const top = String(options.limit ?? 50)
  const query = options.query?.trim()
  const url = query
    ? `${GRAPH}/me/drive/root/search(q='${encodeURIComponent(query.replace(/'/g, "''"))}')?$top=${top}&$select=${SELECT}`
    : `${GRAPH}/me/drive/root/children?$top=${top}&$orderby=lastModifiedDateTime%20desc&$select=${SELECT}`
  let resp: Response
  try {
    resp = await fetchImpl(url, { headers: authHeaders(token) })
  } catch (err) {
    throw new ConnectorError(
      CONNECTOR_ONEDRIVE_ID,
      'network',
      err instanceof Error ? err.message : 'fetch failed',
    )
  }
  if (!resp.ok) throw await graphError(resp)
  const body = (await resp.json()) as { value?: GraphDriveItem[] }
  return (body.value ?? []).filter((it) => it.folder === undefined).map(mapItem)
}

/** Download a OneDrive item's raw bytes. */
export async function downloadOnedriveFile(
  token: string,
  itemId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ArrayBuffer> {
  let resp: Response
  try {
    resp = await fetchImpl(`${GRAPH}/me/drive/items/${encodeURIComponent(itemId)}/content`, {
      headers: authHeaders(token),
    })
  } catch (err) {
    throw new ConnectorError(
      CONNECTOR_ONEDRIVE_ID,
      'network',
      err instanceof Error ? err.message : 'fetch failed',
    )
  }
  if (!resp.ok) throw await graphError(resp)
  return resp.arrayBuffer()
}

/** Upload bytes as a new file in the OneDrive root via a simple PUT (<4MB). */
export async function uploadOnedriveFile(
  token: string,
  input: { name: string; mimeType: string; bytes: ArrayBuffer | Uint8Array },
  fetchImpl: typeof fetch = fetch,
): Promise<ConnectorFile> {
  const path = encodeURIComponent(input.name)
  // Graph's PUT body typings insist on an ArrayBuffer-backed view; a Blob wrapper
  // sidesteps the SharedArrayBuffer generic (as in the Drive connector).
  const body = new Blob([input.bytes as BlobPart], { type: input.mimeType })
  let resp: Response
  try {
    resp = await fetchImpl(`${GRAPH}/me/drive/root:/${path}:/content`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': input.mimeType },
      body,
    })
  } catch (err) {
    throw new ConnectorError(
      CONNECTOR_ONEDRIVE_ID,
      'network',
      err instanceof Error ? err.message : 'fetch failed',
    )
  }
  if (!resp.ok) throw await graphError(resp)
  return mapItem((await resp.json()) as GraphDriveItem)
}
