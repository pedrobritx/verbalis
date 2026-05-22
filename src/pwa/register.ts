import { registerSW } from 'virtual:pwa-register'

export function registerPWA() {
  registerSW({
    onNeedRefresh() {
      // Future: show "update available" toast
    },
    onOfflineReady() {
      // Future: show "ready to work offline" toast
    },
  })
}
