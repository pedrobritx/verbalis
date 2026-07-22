import { describe, it, expect, beforeEach } from 'vitest'
import { useQuickLookupStore } from '@/features/lookup/useQuickLookupStore'

/**
 * The quick-lookup store seeds its languages from (in precedence order) an
 * explicit `openWith` argument, then the active project's languages published by
 * the editor, then nothing (so the workspace falls back to the global lookup
 * defaults). This proves that precedence.
 */
describe('useQuickLookupStore language seeding', () => {
  beforeEach(() => {
    useQuickLookupStore.setState({
      open: false,
      prefill: '',
      sourceLang: undefined,
      targetLang: undefined,
      projectLangs: null,
    })
  })

  it('leaves languages unset when no project langs and no explicit langs', () => {
    useQuickLookupStore.getState().openWith('hello')
    const s = useQuickLookupStore.getState()
    expect(s.open).toBe(true)
    expect(s.prefill).toBe('hello')
    expect(s.sourceLang).toBeUndefined()
    expect(s.targetLang).toBeUndefined()
  })

  it('uses the published project languages when present', () => {
    useQuickLookupStore.getState().setProjectLangs({ source: 'pt', target: 'en' })
    useQuickLookupStore.getState().openWith('termo')
    const s = useQuickLookupStore.getState()
    expect(s.sourceLang).toBe('pt')
    expect(s.targetLang).toBe('en')
  })

  it('lets an explicit openWith argument win over the project languages', () => {
    useQuickLookupStore.getState().setProjectLangs({ source: 'pt', target: 'en' })
    useQuickLookupStore.getState().openWith('mot', { source: 'fr', target: 'de' })
    const s = useQuickLookupStore.getState()
    expect(s.sourceLang).toBe('fr')
    expect(s.targetLang).toBe('de')
  })

  it('clears project languages when the editor unmounts', () => {
    useQuickLookupStore.getState().setProjectLangs({ source: 'pt', target: 'en' })
    useQuickLookupStore.getState().setProjectLangs(null)
    useQuickLookupStore.getState().openWith('x')
    expect(useQuickLookupStore.getState().sourceLang).toBeUndefined()
  })
})
