import { Link } from 'react-router-dom'
import { VerbalisMark } from '@/components/brand/VerbalisMark'
import { BRAND_LINKS, AUTHOR_NAME, LICENSE_URL } from '@/features/about/links'

/**
 * Slim brand footer surfaced on the main (Projects) page so the license,
 * manifesto and author links are always reachable without hunting.
 */
export function BrandFooter() {
  return (
    <footer
      className="mt-2 flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between"
      style={{ borderColor: 'var(--color-border)' }}
    >
      <div className="flex items-center gap-2 text-footnote" style={{ color: 'var(--color-muted)' }}>
        <VerbalisMark size={18} />
        <span>
          Verbalis — local-first CAT tool by{' '}
          <Link to="/about" className="underline underline-offset-2 hover:opacity-80">
            {AUTHOR_NAME}
          </Link>
        </span>
      </div>

      <div className="flex items-center gap-1">
        {BRAND_LINKS.map(({ label, href, icon: Icon }) => (
          <a
            key={href}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={label}
            title={label}
            className="p-2 rounded transition-colors hover:bg-[var(--color-fill)]"
            style={{ color: 'var(--color-muted)' }}
          >
            <Icon size={16} />
          </a>
        ))}
        <span className="mx-1 h-4 w-px" style={{ background: 'var(--color-border)' }} aria-hidden />
        <Link
          to="/about"
          className="px-2 py-1 text-footnote rounded transition-colors hover:bg-[var(--color-fill)]"
          style={{ color: 'var(--color-muted)' }}
        >
          About
        </Link>
        <a
          href={LICENSE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="px-2 py-1 text-footnote rounded transition-colors hover:bg-[var(--color-fill)]"
          style={{ color: 'var(--color-muted)' }}
        >
          License
        </a>
      </div>
    </footer>
  )
}
