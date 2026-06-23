import { Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import ProjectsPage from '@/features/projects'
import { lazyWithRetry } from './lazyWithRetry'
import { RouteErrorBoundary } from './ErrorBoundary'

// Projects is the landing route, so it stays eager. Every other page — and the
// heavy dependencies they pull in (the Lexical editor, transformers, etc.) — is
// code-split out of the initial bundle so the first paint isn't held up by code
// the user may never reach. `lazyWithRetry` recovers from a stale-chunk import
// failure (e.g. an old client after a new deploy) instead of blanking the page.
const TranslationPage = lazyWithRetry(() => import('@/features/translation'), 'translation')
const TranslatePage = lazyWithRetry(() => import('@/features/translate'), 'translate')
const TMPage = lazyWithRetry(() => import('@/features/tm'), 'tm')
const TerminologyPage = lazyWithRetry(() => import('@/features/terminology'), 'terminology')
const CorporaPage = lazyWithRetry(() => import('@/features/corpora'), 'corpora')
const GuidePage = lazyWithRetry(() => import('@/features/guide'), 'guide')
const SettingsPage = lazyWithRetry(() => import('@/features/settings'), 'settings')
const AboutPage = lazyWithRetry(() => import('@/features/about'), 'about')

function RouteFallback() {
  return (
    <div className="text-sm" style={{ color: 'var(--color-muted)' }}>
      Loading…
    </div>
  )
}

export function AppRoutes() {
  return (
    <RouteErrorBoundary>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<ProjectsPage />} />
          <Route path="/translate" element={<TranslatePage />} />
          <Route path="/project/:id" element={<TranslationPage />} />
          <Route path="/tm" element={<TMPage />} />
          <Route path="/terminology" element={<TerminologyPage />} />
          <Route path="/corpora" element={<CorporaPage />} />
          <Route path="/guide" element={<GuidePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/about" element={<AboutPage />} />
        </Routes>
      </Suspense>
    </RouteErrorBoundary>
  )
}
