import type { PublicClientApplication } from '@azure/msal-browser'
import { ConnectorError } from '../types'
import { CONNECTOR_ONEDRIVE_ID, msalClientId } from './config'

/**
 * Microsoft identity (MSAL) token acquisition for OneDrive (Phase 6.4).
 *
 * Uses `@azure/msal-browser` via a **dynamic import** (ROADMAP §6.4) so the
 * library never weighs on the initial bundle and only loads when the user first
 * reaches for OneDrive. `loginPopup` (not a redirect) avoids any interplay with
 * the app's HashRouter. Tokens are cached by MSAL in `sessionStorage` and reused
 * via `acquireTokenSilent`; nothing is persisted to Dexie. Pure client OAuth —
 * independent of Supabase, so it works for 100%-local users too.
 */

const GRAPH_SCOPES = ['Files.ReadWrite']

let appPromise: Promise<PublicClientApplication> | null = null

async function getApp(): Promise<PublicClientApplication> {
  const clientId = msalClientId()
  if (!clientId) throw new ConnectorError(CONNECTOR_ONEDRIVE_ID, 'auth', 'Microsoft client id not configured')
  if (appPromise) return appPromise
  appPromise = (async () => {
    const { PublicClientApplication } = await import('@azure/msal-browser')
    const app = new PublicClientApplication({
      auth: { clientId, authority: 'https://login.microsoftonline.com/common' },
      cache: { cacheLocation: 'sessionStorage' },
    })
    await app.initialize()
    return app
  })()
  return appPromise
}

/**
 * Return a valid Microsoft Graph access token, silently when an account is
 * already signed in (this session), otherwise via a login popup.
 */
export async function requestGraphToken(interactive = false): Promise<string> {
  const app = await getApp()
  const accounts = app.getAllAccounts()
  if (!interactive && accounts.length > 0) {
    try {
      const res = await app.acquireTokenSilent({ scopes: GRAPH_SCOPES, account: accounts[0] })
      return res.accessToken
    } catch {
      // Silent acquisition failed (expired/needs consent) — fall back to the popup.
    }
  }
  try {
    const res = await app.loginPopup({ scopes: GRAPH_SCOPES })
    return res.accessToken
  } catch (err) {
    throw new ConnectorError(
      CONNECTOR_ONEDRIVE_ID,
      'auth',
      err instanceof Error ? err.message : 'Authorisation cancelled',
    )
  }
}
