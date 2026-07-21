import type {
  ConnectorFile,
  ConnectorUpload,
  ListFilesOptions,
  StorageConnector,
} from '../types'
import { CONNECTOR_ONEDRIVE_ID, isOnedriveConfigured } from './config'
import { downloadOnedriveFile, listOnedriveFiles, uploadOnedriveFile } from './graphApi'
import { requestGraphToken } from './msal'

export {
  CONNECTOR_ONEDRIVE_ID,
  isOnedriveConfigured,
  isOnedriveAvailable,
  msalClientId,
} from './config'

/**
 * The OneDrive storage connector (Phase 6.4) — pairs the MSAL token client with
 * the pure Graph REST layer, exactly as the Google Drive connector pairs GIS
 * with `driveApi`. Built through a factory so tests can inject a fake token
 * getter + `fetchImpl` (no MSAL, no network); the exported `onedriveConnector`
 * singleton uses the real MSAL popup + `fetch`.
 */

export interface OnedriveDeps {
  /** Acquire a Graph access token (real MSAL by default). */
  getToken: (interactive?: boolean) => Promise<string>
  fetchImpl: typeof fetch
}

export function createOnedriveConnector(deps: OnedriveDeps): StorageConnector {
  const { getToken, fetchImpl } = deps
  return {
    id: CONNECTOR_ONEDRIVE_ID,
    name: 'OneDrive',
    isConfigured: isOnedriveConfigured,
    async listFiles(options?: ListFilesOptions): Promise<ConnectorFile[]> {
      const token = await getToken()
      return listOnedriveFiles(token, options, fetchImpl)
    },
    async downloadFile(file: ConnectorFile): Promise<File> {
      const token = await getToken()
      const bytes = await downloadOnedriveFile(token, file.id, fetchImpl)
      return new File([bytes], file.name, {
        type: file.mimeType || 'application/octet-stream',
      })
    },
    async uploadFile(input: ConnectorUpload): Promise<ConnectorFile> {
      const token = await getToken()
      return uploadOnedriveFile(token, input, fetchImpl)
    },
  }
}

/** The process-wide OneDrive connector (real MSAL token + `fetch`). */
export const onedriveConnector: StorageConnector = createOnedriveConnector({
  getToken: requestGraphToken,
  fetchImpl: (...args) => fetch(...args),
})
