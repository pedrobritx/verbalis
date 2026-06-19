import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Markdown } from '@/features/guide/Markdown'

const SAMPLE = `# Title

Some **bold** and \`code\` and a [link](https://example.com).

- one
- two

| Source | Target |
| ------ | ------ |
| acórdão | appellate decision |

\`\`\`
python3 scripts/lookup.py "leniency"
\`\`\`
`

describe('Markdown renderer', () => {
  it('renders headings, emphasis, links, lists, tables and code', () => {
    render(<Markdown content={SAMPLE} />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Title')
    expect(screen.getByText('bold')).toBeInTheDocument()
    const link = screen.getByRole('link', { name: 'link' })
    expect(link).toHaveAttribute('href', 'https://example.com')
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByText('acórdão')).toBeInTheDocument()
    expect(screen.getByText('one')).toBeInTheDocument()
  })

  it('renders empty content without crashing', () => {
    const { container } = render(<Markdown content="" />)
    expect(container.querySelector('.markdown-body')).toBeInTheDocument()
  })
})
