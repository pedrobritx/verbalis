import { describe, expect, it, vi } from 'vitest'
import {
  stripAuthQuery,
  hasAuthRedirect,
  maybeHandleAuthRedirect,
} from '@/storage/cloud/authBootstrap'

describe('stripAuthQuery', () => {
  it('drops the query but keeps the hash route (the PKCE/HashRouter case)', () => {
    expect(stripAuthQuery('https://verbalis.britx.me/?code=abc123#/project/y')).toBe(
      'https://verbalis.britx.me/#/project/y',
    )
  })

  it('drops multiple auth params', () => {
    expect(stripAuthQuery('https://host/?code=abc&error=denied')).toBe('https://host/')
  })

  it('leaves a URL with no query untouched', () => {
    expect(stripAuthQuery('https://host/#/tm')).toBe('https://host/#/tm')
  })

  it('preserves localhost dev origin + port', () => {
    expect(stripAuthQuery('http://localhost:5173/?code=x#/')).toBe('http://localhost:5173/#/')
  })
})

describe('hasAuthRedirect', () => {
  it('is true for a PKCE code', () => {
    expect(hasAuthRedirect('?code=abc123')).toBe(true)
  })

  it('is true for an auth error', () => {
    expect(hasAuthRedirect('?error=access_denied&error_description=x')).toBe(true)
  })

  it('is false for an unrelated query', () => {
    expect(hasAuthRedirect('?ref=newsletter')).toBe(false)
  })

  it('is false for an empty query', () => {
    expect(hasAuthRedirect('')).toBe(false)
  })
})

describe('maybeHandleAuthRedirect', () => {
  it('is a no-op that never touches history when the cloud is unconfigured', async () => {
    // In the test env VITE_SUPABASE_URL is unset → isCloudConfigured() is false,
    // so the bootstrap must return before importing Supabase or rewriting the URL.
    const replaceState = vi.spyOn(window.history, 'replaceState')
    await expect(maybeHandleAuthRedirect()).resolves.toBeUndefined()
    expect(replaceState).not.toHaveBeenCalled()
    replaceState.mockRestore()
  })
})
