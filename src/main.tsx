import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app/App'
import './styles/globals.css'
import { registerPWA } from './pwa/register'
import { maybeHandleAuthRedirect } from './storage/cloud/authBootstrap'
import { isCloudConfigured } from './storage/cloud/supabaseClient'

registerPWA()

// Start the background cloud reconcilers (ROADMAP §3.3 settings, §3.4 personal
// term bank + TM) only when the cloud is configured, loading their code (and the
// auth store they drive) lazily so the local-only bundle is unchanged. They pull
// on sign-in and push changes in the background; Dexie stays the read path.
if (isCloudConfigured()) {
  void import('./storage/cloud/settingsSync').then((m) => m.startSettingsSync())
  void import('./storage/cloud/rowSync').then((m) => m.startRowSync())
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
