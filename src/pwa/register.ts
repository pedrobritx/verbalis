import { registerSW } from 'virtual:pwa-register'
import { setNeedRefresh, setOfflineReady, setUpdateSW } from './usePwaStore'

export function registerPWA() {
  const updateSW = registerSW({
    onNeedRefresh() {
      setNeedRefresh(true)
    },
    onOfflineReady() {
      setOfflineReady(true)
    },
  })
  setUpdateSW(updateSW)
}
