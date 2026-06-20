import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import ProjectsPage from '@/features/projects'

// Projects is the landing route, so it stays eager. Every other page — and the
// heavy dependencies they pull in (the Lexical editor, transformers, etc.) — is
// code-split out of the initial bundle so the first paint isn't held up by code
// the user may never reach.
const TranslationPage = lazy(() => import('@/features/translation'))
const TranslatePage = lazy(() => import('@/features/translate'))
const TMPage = lazy(() => import('@/features/tm'))
const TerminologyPage = lazy(() => import('@/features/terminology'))
const CorporaPage = lazy(() => import('@/features/corpora'))
const GuidePage = lazy(() => import('@/features/guide'))
const SettingsPage = lazy(() => import('@/features/settings'))
const AboutPage = lazy(() => import('@/features/about'))

function RouteFallback() {
  return (
    <div className="text-sm" style={{ color: 'var(--color-muted)' }}>
      Loading…
    </div>
  )
}

export function AppRoutes() {
  return (
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
  )
}
