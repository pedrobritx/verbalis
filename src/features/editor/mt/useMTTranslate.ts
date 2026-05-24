import { useCallback, useEffect, useRef, useState } from 'react'
import type { MTProviderId, MTSettings } from '@/core/types'
import { MTError, translateWith, type TranslateResult } from '@/core/mt'

export interface UseMTTranslateOptions {
  source: string | undefined
  sourceLang: string
  targetLang: string
  providerId: MTProviderId | undefined
  settings: MTSettings
}

export interface UseMTTranslateState {
  result: TranslateResult | null
  loading: boolean
  error: MTError | null
  elapsedMs: number | null
  translate: () => Promise<void>
  reset: () => void
}

export function useMTTranslate(opts: UseMTTranslateOptions): UseMTTranslateState {
  const [result, setResult] = useState<TranslateResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<MTError | null>(null)
  const [elapsedMs, setElapsedMs] = useState<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const reset = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setResult(null)
    setError(null)
    setElapsedMs(null)
    setLoading(false)
  }, [])

  // Reset whenever the focused source changes — stale suggestions are misleading.
  useEffect(() => {
    reset()
  }, [opts.source, reset])

  const translate = useCallback(async () => {
    const text = opts.source?.trim()
    if (!text || !opts.providerId) return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    setError(null)
    setResult(null)
    const started = performance.now()
    try {
      const res = await translateWith(
        opts.providerId,
        {
          text,
          sourceLang: opts.sourceLang,
          targetLang: opts.targetLang,
          signal: controller.signal,
        },
        opts.settings,
      )
      if (controller.signal.aborted) return
      setResult(res)
      setElapsedMs(Math.round(performance.now() - started))
    } catch (err) {
      if (controller.signal.aborted) return
      if (err instanceof MTError) setError(err)
      else if (err instanceof Error)
        setError(new MTError(opts.providerId, 'invalid', err.message))
      else setError(new MTError(opts.providerId, 'invalid', 'Translation failed'))
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setLoading(false)
    }
  }, [opts.source, opts.sourceLang, opts.targetLang, opts.providerId, opts.settings])

  return { result, loading, error, elapsedMs, translate, reset }
}
