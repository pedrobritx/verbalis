import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app/App'
import './styles/globals.css'
import { registerPWA } from './pwa/register'
import { maybeHandleAuthRedirect } from './storage/cloud/authBootstrap'

registerPWA()

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
