import { describe, it, expect, beforeEach } from 'vitest'
import {
  usePwaStore,
  setNeedRefresh,
  setOfflineReady,
  setUpdateSW,
  OFFLINE_READY_ACK_KEY,
} from '@/pwa/usePwaStore'

describe('usePwaStore', () => {
  beforeEach(() => {
    usePwaStore.setState({
      needRefresh: false,
      offlineReady: false,
      updateSW: null,
    })
    localStorage.clear()
  })

  it('setNeedRefresh flips the flag', () => {
    expect(usePwaStore.getState().needRefresh).toBe(false)
    setNeedRefresh(true)
    expect(usePwaStore.getState().needRefresh).toBe(true)
  })

  it('setNeedRefresh(true) clears the offline-ready ack so post-update install re-confirms', () => {
    localStorage.setItem(OFFLINE_READY_ACK_KEY, '1')
    setNeedRefresh(true)
    expect(localStorage.getItem(OFFLINE_READY_ACK_KEY)).toBeNull()
  })

  it('setOfflineReady flips the flag', () => {
    setOfflineReady(true)
    expect(usePwaStore.getState().offlineReady).toBe(true)
  })

  it('setUpdateSW stores the function reference', async () => {
    const fn = async () => {}
    setUpdateSW(fn)
    expect(usePwaStore.getState().updateSW).toBe(fn)
  })

  it('dismissRefresh resets needRefresh to false', () => {
    setNeedRefresh(true)
    usePwaStore.getState().dismissRefresh()
    expect(usePwaStore.getState().needRefresh).toBe(false)
  })

  it('ackOfflineReady resets offlineReady to false', () => {
    setOfflineReady(true)
    usePwaStore.getState().ackOfflineReady()
    expect(usePwaStore.getState().offlineReady).toBe(false)
  })
})
