import type {
  ConnectorFile,
  ConnectorUpload,
  ListFilesOptions,
  StorageConnector,
} from '../types'
import { CONNECTOR_GDRIVE_ID, isGdriveConfigured } from './config'
import { downloadDriveFile, listDriveFiles, uploadDriveFile } from './driveApi'
import { requestDriveToken } from './gis'

export { CONNECTOR_GDRIVE_ID, isGdriveConfigured, isGdriveAvailable, googleClientId } from './config'

/**
 * The Google Drive storage connector (Phase 6.3) — pairs the GIS token client
 * with the pure `driveApi` REST layer. Built through a factory so tests can
 * inject a fake token getter + `fetchImpl` (no GIS, no network); the exported
 * `gdriveConnector` singleton uses the real GIS popup + `fetch`.
 */

export interface GdriveDeps {
  /** Acquire a Drive access token (real GIS by default). */
  getToken: (forceConsent?: boolean) => Promise<string>
  fetchImpl: typeof fetch
}

export function createGdriveConnector(deps: GdriveDeps): StorageConnector {
  const { getToken, fetchImpl } = deps
  return {
    id: CONNECTOR_GDRIVE_ID,
    name: 'Google Drive',
    isConfigured: isGdriveConfigured,
    async listFiles(options?: ListFilesOptions): Promise<ConnectorFile[]> {
      const token = await getToken()
      return listDriveFiles(token, options, fetchImpl)
    },
    async downloadFile(file: ConnectorFile): Promise<File> {
      const token = await getToken()
      const bytes = await downloadDriveFile(token, file.id, fetchImpl)
      return new File([bytes], file.name, {
        type: file.mimeType || 'application/octet-stream',
      })
    },
    async uploadFile(input: ConnectorUpload): Promise<ConnectorFile> {
      const token = await getToken()
      return uploadDriveFile(token, input, fetchImpl)
    },
  }
}

/** The process-wide Google Drive connector (real GIS token + `fetch`). */
export const gdriveConnector: StorageConnector = createGdriveConnector({
  getToken: requestDriveToken,
  fetchImpl: (...args) => fetch(...args),
})
