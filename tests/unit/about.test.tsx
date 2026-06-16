import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import AboutPage from '@/features/about'

describe('AboutPage', () => {
  it('renders the manifesto', () => {
    render(<AboutPage />)
    expect(screen.getByText(/Why Verbalis exists/i)).toBeInTheDocument()
    expect(screen.getByText(/local-first by default/i)).toBeInTheDocument()
  })

  it('surfaces both license tiers', () => {
    render(<AboutPage />)
    expect(screen.getByText(/Individuals — free/i)).toBeInTheDocument()
    expect(screen.getByText(/Organizations — get in touch/i)).toBeInTheDocument()
  })

  it('links to the repo, profile, website and funding', () => {
    render(<AboutPage />)
    const hrefs = Array.from(document.querySelectorAll('a')).map((a) => a.getAttribute('href'))
    expect(hrefs).toContain('https://github.com/pedrobritx/verbalis')
    expect(hrefs).toContain('https://www.linkedin.com/in/pedrobritx/')
    expect(hrefs).toContain('https://pedrobritx.github.io/EwP/')
    expect(hrefs).toContain('https://buymeacoffee.com/pedrobritx')
  })
})
