import { ConnectorError } from '../types'
import { CONNECTOR_GDRIVE_ID, googleClientId } from './config'

/**
 * Google Identity Services (GIS) OAuth token client (Phase 6.3).
 *
 * Pure client-side OAuth: the GSI script is injected on first use, an access
 * token for the `drive.file` scope is requested via a popup, and the token lives
 * **only in memory** (never Dexie, never localStorage) — it evaporates on
 * reload, matching the connector's session-only contract. No Supabase, so this
 * works for 100%-local users. This DOM boundary is intentionally thin; the
 * testable logic lives in the pure `driveApi` layer.
 */

const GSI_SRC = 'https://accounts.google.com/gsi/client'
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'
// Refresh a little before the real expiry to avoid a mid-request 401.
const EXPIRY_SKEW_MS = 60_000

interface TokenResponse {
  access_token?: string
  expires_in?: number
  error?: string
  error_description?: string
}
interface TokenClient {
  requestAccessToken(overrides?: { prompt?: string }): void
  callback: (resp: TokenResponse) => void
}
interface GoogleOAuth2 {
  initTokenClient(config: {
    client_id: string
    scope: string
    prompt?: string
    callback: (resp: TokenResponse) => void
    error_callback?: (err: { type?: string; message?: string }) => void
  }): TokenClient
}
interface GoogleGlobal {
  accounts?: { oauth2?: GoogleOAuth2 }
}

declare global {
  interface Window {
    google?: GoogleGlobal
  }
}

let scriptPromise: Promise<GoogleOAuth2> | null = null
let cachedToken: { value: string; expiresAt: number } | null = null

function loadGis(): Promise<GoogleOAuth2> {
  if (window.google?.accounts?.oauth2) return Promise.resolve(window.google.accounts.oauth2)
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise<GoogleOAuth2>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SRC}"]`)
    const onReady = () => {
      const oauth2 = window.google?.accounts?.oauth2
      if (oauth2) resolve(oauth2)
      else reject(new ConnectorError(CONNECTOR_GDRIVE_ID, 'network', 'Google Identity Services failed to initialise'))
    }
    if (existing) {
      existing.addEventListener('load', onReady, { once: true })
      existing.addEventListener('error', () => reject(new ConnectorError(CONNECTOR_GDRIVE_ID, 'network', 'Failed to load Google Identity Services')), { once: true })
      return
    }
    const script = document.createElement('script')
    script.src = GSI_SRC
    script.async = true
    script.defer = true
    script.onload = onReady
    script.onerror = () => reject(new ConnectorError(CONNECTOR_GDRIVE_ID, 'network', 'Failed to load Google Identity Services'))
    document.head.appendChild(script)
  })
  return scriptPromise
}

/**
 * Return a valid Drive access token, prompting the user for consent the first
 * time (or when the cached token has expired). `forceConsent` re-prompts.
 */
export async function requestDriveToken(forceConsent = false): Promise<string> {
  const clientId = googleClientId()
  if (!clientId) throw new ConnectorError(CONNECTOR_GDRIVE_ID, 'auth', 'Google client id not configured')
  if (!forceConsent && cachedToken && cachedToken.expiresAt - EXPIRY_SKEW_MS > Date.now()) {
    return cachedToken.value
  }
  const oauth2 = await loadGis()
  return new Promise<string>((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: (resp) => {
        if (resp.error || !resp.access_token) {
          reject(new ConnectorError(CONNECTOR_GDRIVE_ID, 'auth', resp.error_description || resp.error || 'Authorisation failed'))
          return
        }
        cachedToken = {
          value: resp.access_token,
          expiresAt: Date.now() + (resp.expires_in ?? 3600) * 1000,
        }
        resolve(resp.access_token)
      },
      error_callback: (err) => {
        reject(new ConnectorError(CONNECTOR_GDRIVE_ID, 'auth', err.message || 'Authorisation cancelled'))
      },
    })
    client.requestAccessToken({ prompt: forceConsent ? 'consent' : '' })
  })
}

/** Drop the in-memory token (e.g. on an auth failure) so the next call re-prompts. */
export function resetDriveToken(): void {
  cachedToken = null
}
