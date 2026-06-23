import { lazy, type ComponentType } from 'react'

type Factory<T> = () => Promise<{ default: ComponentType<T> }>

/**
 * `React.lazy` with resilience against transient and stale-chunk import
 * failures. On a deployed PWA, a new release renames hashed chunks; a client
 * still running the old `index.html` (e.g. via a not-yet-updated service worker)
 * can request a chunk that no longer exists, the dynamic `import()` rejects, and
 * — with no error boundary — the whole app blanks.
 *
 * This retries the import once, and if it still fails does a single full reload
 * (guarded by a sessionStorage flag so it can never loop) to pull the fresh
 * `index.html` and its current chunk graph.
 */
export function lazyWithRetry<T>(factory: Factory<T>, key: string) {
  return lazy(async () => {
    const flag = `lazy-retry:${key}`
    try {
      const mod = await factory()
      clearLazyRetryFlag(key)
      return mod
    } catch (err) {
      // One in-place retry handles a transient network blip.
      try {
        const mod = await factory()
        clearLazyRetryFlag(key)
        return mod
      } catch (err2) {
        const alreadyReloaded =
          typeof sessionStorage !== 'undefined' && sessionStorage.getItem(flag) === '1'
        if (!alreadyReloaded && typeof window !== 'undefined') {
          try {
            sessionStorage.setItem(flag, '1')
          } catch {
            // Storage unavailable (private mode) — fall through to rethrow.
          }
          window.location.reload()
          // Return a never-resolving promise so Suspense holds while reloading.
          return new Promise<{ default: ComponentType<T> }>(() => {})
        }
        throw err2 ?? err
      }
    }
  })
}

/** Clear the one-shot reload guard once a chunk has loaded successfully. */
export function clearLazyRetryFlag(key: string): void {
  try {
    sessionStorage.removeItem(`lazy-retry:${key}`)
  } catch {
    // ignore
  }
}
