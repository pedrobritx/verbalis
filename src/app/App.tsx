import { Providers } from './providers'
import { AppShell } from '@/components/layout/AppShell'
import { AppRoutes } from './routes'
import { CommandPalette } from '@/features/command-palette/CommandPalette'
import { GlobalShortcuts } from '@/features/command-palette/useGlobalShortcuts'
import { GlobalImportDialog } from '@/features/import/GlobalImportDialog'

export default function App() {
  return (
    <Providers>
      <GlobalShortcuts />
      <AppShell>
        <AppRoutes />
      </AppShell>
      <CommandPalette />
      <GlobalImportDialog />
    </Providers>
  )
}
