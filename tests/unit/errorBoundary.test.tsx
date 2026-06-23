import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route, Link } from 'react-router-dom'
import { ErrorBoundary, RouteErrorBoundary } from '@/app/ErrorBoundary'

function Boom({ message = 'kaboom' }: { message?: string }): JSX.Element {
  throw new Error(message)
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // React logs caught errors to console.error; keep test output clean.
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>healthy</p>
      </ErrorBoundary>,
    )
    expect(screen.getByText('healthy')).toBeInTheDocument()
    expect(screen.queryByTestId('error-boundary-fallback')).not.toBeInTheDocument()
  })

  it('shows a recoverable fallback (not a blank page) when a child throws', () => {
    render(
      <ErrorBoundary>
        <Boom message="editor exploded" />
      </ErrorBoundary>,
    )
    expect(screen.getByTestId('error-boundary-fallback')).toBeInTheDocument()
    expect(screen.getByTestId('error-boundary-message')).toHaveTextContent('editor exploded')
    expect(screen.getByTestId('error-boundary-reload')).toBeInTheDocument()
    expect(screen.getByTestId('error-boundary-home')).toBeInTheDocument()
  })

  it('clears the error when resetKey changes', () => {
    const { rerender } = render(
      <ErrorBoundary resetKey="/project/a">
        <Boom />
      </ErrorBoundary>,
    )
    expect(screen.getByTestId('error-boundary-fallback')).toBeInTheDocument()

    rerender(
      <ErrorBoundary resetKey="/">
        <p>recovered</p>
      </ErrorBoundary>,
    )
    expect(screen.getByText('recovered')).toBeInTheDocument()
    expect(screen.queryByTestId('error-boundary-fallback')).not.toBeInTheDocument()
  })

  it('RouteErrorBoundary recovers after navigating away from the broken route', () => {
    render(
      <MemoryRouter initialEntries={['/broken']}>
        <RouteErrorBoundary>
          <Routes>
            <Route path="/" element={<p>projects</p>} />
            <Route path="/broken" element={<Boom />} />
          </Routes>
        </RouteErrorBoundary>
      </MemoryRouter>,
    )
    // The broken route shows the fallback; "Back to projects" navigates home and
    // the path change resets the boundary so the healthy route renders.
    expect(screen.getByTestId('error-boundary-fallback')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('error-boundary-home'))
    expect(screen.getByText('projects')).toBeInTheDocument()
    expect(screen.queryByTestId('error-boundary-fallback')).not.toBeInTheDocument()
  })
})
