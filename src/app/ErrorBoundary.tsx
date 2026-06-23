import { Component, type ErrorInfo, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { RotateCcw, FolderOpen, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ErrorBoundaryProps {
  children: ReactNode
  /** When this value changes, a caught error is cleared (e.g. on navigation). */
  resetKey?: unknown
  /** Invoked by the "Back to projects" action. */
  onGoHome?: () => void
}

interface ErrorBoundaryState {
  error: Error | null
}

/**
 * App-level error boundary. Without one, any uncaught error thrown while
 * rendering a route (including a failed `React.lazy` dynamic import) unmounts the
 * entire React tree and leaves a blank page with no way to recover. This catches
 * that error, keeps the surrounding app shell mounted, and shows a readable,
 * recoverable fallback instead of a blank screen.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surface the error so it is recoverable from devtools / remote logging even
    // on the deployed PWA where opening the console is awkward.
    console.error('Uncaught render error:', error, info.componentStack)
  }

  componentDidUpdate(prev: ErrorBoundaryProps): void {
    // Clear the error once the user navigates elsewhere (resetKey changes).
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null })
    }
  }

  private handleHome = (): void => {
    this.setState({ error: null })
    this.props.onGoHome?.()
  }

  render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <div
          role="alert"
          data-testid="error-boundary-fallback"
          className="flex w-full max-w-lg flex-col gap-4 rounded-lg border p-6"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle size={24} style={{ color: 'var(--color-error)' }} className="shrink-0" />
            <div className="flex flex-col gap-1 min-w-0">
              <h2 className="text-title-3 font-semibold" style={{ color: 'var(--color-text)' }}>
                Something went wrong
              </h2>
              <p className="text-callout" style={{ color: 'var(--color-muted)' }}>
                This page hit an unexpected error. Your projects and data are stored locally and
                are safe — try reloading, or head back to your projects.
              </p>
            </div>
          </div>

          <pre
            className="max-h-40 overflow-auto rounded-md border p-3 text-xs whitespace-pre-wrap break-words"
            style={{
              borderColor: 'var(--color-border)',
              background: 'var(--color-bg)',
              color: 'var(--color-muted)',
              fontFamily: 'var(--font-mono)',
            }}
            data-testid="error-boundary-message"
          >
            {error.message || String(error)}
          </pre>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => window.location.reload()} data-testid="error-boundary-reload">
              <RotateCcw />
              Reload
            </Button>
            <Button variant="bordered" onClick={this.handleHome} data-testid="error-boundary-home">
              <FolderOpen />
              Back to projects
            </Button>
          </div>
        </div>
      </div>
    )
  }
}

/**
 * Router-aware wrapper: resets the boundary when the path changes and wires the
 * "Back to projects" action to client-side navigation.
 */
export function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  return (
    <ErrorBoundary resetKey={pathname} onGoHome={() => navigate('/')}>
      {children}
    </ErrorBoundary>
  )
}
