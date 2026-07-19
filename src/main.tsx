import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app/App'
import './styles/globals.css'
import { registerPWA } from './pwa/register'
import { maybeHandleAuthRedirect } from './storage/cloud/authBootstrap'
import { isCloudConfigured } from './storage/cloud/supabaseClient'

registerPWA()

// Start the background settings reconciler (ROADMAP §3.3) only when the cloud is
// configured, and load its code (and the auth store it drives) lazily so the
// local-only bundle is unchanged. It pulls on sign-in and pushes allowlisted
// preference changes; Dexie stays the read path throughout.
if (isCloudConfigured()) {
  void import('./storage/cloud/settingsSync').then((m) => m.startSettingsSync())
}

// Exchange an OAuth / magic-link `?code=` and strip it before the hash router
// mounts (ROADMAP §3 D7). A no-op — and loads no Supabase code — when the cloud
// is unconfigured or there is no redirect to handle, so local-only boot is
// unchanged apart from awaiting one already-resolved promise.
void maybeHandleAuthRedirect().finally(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
})
