import { Routes, Route } from 'react-router-dom'
import ProjectsPage from '@/features/projects'
import TranslationPage from '@/features/translation'
import TranslatePage from '@/features/translate'
import TMPage from '@/features/tm'
import TerminologyPage from '@/features/terminology'
import SettingsPage from '@/features/settings'

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<ProjectsPage />} />
      <Route path="/translate" element={<TranslatePage />} />
      <Route path="/project/:id" element={<TranslationPage />} />
      <Route path="/tm" element={<TMPage />} />
      <Route path="/terminology" element={<TerminologyPage />} />
      <Route path="/settings" element={<SettingsPage />} />
    </Routes>
  )
}
