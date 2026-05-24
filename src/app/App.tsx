import { Providers } from './providers'
import { AppShell } from '@/components/layout/AppShell'
import { AppRoutes } from './routes'
import { CommandPalette } from '@/features/command-palette/CommandPalette'
import { GlobalShortcuts } from '@/features/command-palette/useGlobalShortcuts'
import { GlobalImportDialog } from '@/features/import/GlobalImportDialog'
import { QuickLookupDialog } from '@/features/lookup/QuickLookupDialog'
import { UpdateBanner } from '@/pwa/UpdateBanner'
import { OfflineReadyToast } from '@/pwa/OfflineReadyToast'

export default function App() {
  return (
    <Providers>
      <GlobalShortcuts />
      <AppShell>
        <AppRoutes />
      </AppShell>
      <CommandPalette />
      <GlobalImportDialog />
      <QuickLookupDialog />
      <UpdateBanner />
      <OfflineReadyToast />
    </Providers>
  )
}
