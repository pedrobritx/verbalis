/**
 * Generic storage-connector contract (ROADMAP §6.3/§6.4, D9).
 *
 * A storage connector lets Verbalis read files from and write files to a cloud
 * drive (Google Drive first, OneDrive in 6.4) as a built-in addon. The contract
 * is deliberately provider-agnostic so the `ConnectorFilePicker` and the
 * import/export wiring are written once and reused by every connector. Auth is
 * the connector's own concern (pure client OAuth — no Supabase dependency), and
 * access tokens live only in memory/session, never in Dexie.
 */

/** A file as listed by a connector (the fields the picker needs). */
export interface ConnectorFile {
  /** Provider-native file id. */
  id: string
  /** Display name including extension. */
  name: string
  /** MIME type, when the provider reports it. */
  mimeType?: string
  /** ISO timestamp of the last modification, when available. */
  modifiedTime?: string
  /** Size in bytes, when available. */
  sizeBytes?: number
}

/** Bytes to upload to a connector, with the target file name and type. */
export interface ConnectorUpload {
  name: string
  mimeType: string
  bytes: ArrayBuffer | Uint8Array
}

export interface ListFilesOptions {
  /** Free-text query the connector may use to narrow the listing. */
  query?: string
  /** Maximum number of files to return. */
  limit?: number
}

/**
 * A pluggable cloud-drive connector. Implementations pair this with an
 * `ExtensionManifest` (kind `storage-connector`) so the Add-ons page can list
 * and toggle them.
 */
export interface StorageConnector {
  /** The manifest id this connector is paired to, e.g. `connector.gdrive`. */
  id: string
  /** Human-facing name shown in the picker and buttons. */
  name: string
  /** True when the connector has the build-time config it needs (e.g. a client id). */
  isConfigured(): boolean
  /** List files, acquiring/refreshing an access token as needed. */
  listFiles(options?: ListFilesOptions): Promise<ConnectorFile[]>
  /** Download a file's bytes, returned as a `File` ready for the import flow. */
  downloadFile(file: ConnectorFile): Promise<File>
  /** Upload bytes, returning the created file's metadata. */
  uploadFile(input: ConnectorUpload): Promise<ConnectorFile>
}

/** A recoverable connector failure with a coarse cause (mirrors `MTError`). */
export type ConnectorErrorCode =
  | 'auth' // token missing / rejected / consent denied
  | 'rate_limit'
  | 'invalid'
  | 'network'
  | 'aborted'

export class ConnectorError extends Error {
  code: ConnectorErrorCode
  connectorId: string
  constructor(connectorId: string, code: ConnectorErrorCode, message: string) {
    super(message)
    this.code = code
    this.connectorId = connectorId
    this.name = 'ConnectorError'
  }
}
