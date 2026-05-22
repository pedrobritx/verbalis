import { Providers } from './providers'
import { AppShell } from '@/components/layout/AppShell'
import { AppRoutes } from './routes'

export default function App() {
  return (
    <Providers>
      <AppShell>
        <AppRoutes />
      </AppShell>
    </Providers>
  )
}
