import { Routes, Route } from 'react-router-dom'
import ProjectsPage from '@/features/projects'
import TranslationPage from '@/features/translation'
import SettingsPage from '@/features/settings'

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<ProjectsPage />} />
      <Route path="/project/:id" element={<TranslationPage />} />
      <Route path="/settings" element={<SettingsPage />} />
    </Routes>
  )
}
