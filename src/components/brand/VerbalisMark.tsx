/**
 * VerbalisMark — the Verbalis brand symbol.
 *
 * Two offset strokes form a "V": a bold accent "first voice" and a lighter,
 * translucent "second voice" converging at a single point — two languages in
 * dialogue, resolved into one. Inherits its accent from `currentColor` so it
 * tints correctly in both themes; pass `withTile` for the rounded-square app
 * icon treatment (used on the About page), or omit it for an inline glyph
 * (used in the top bar).
 */
interface VerbalisMarkProps {
  size?: number
  withTile?: boolean
  className?: string
  title?: string
}

export function VerbalisMark({
  size = 24,
  withTile = false,
  className,
  title = 'Verbalis',
}: VerbalisMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label={title}
      style={{ color: 'var(--color-accent)' }}
    >
      {withTile && (
        <>
          <defs>
            <linearGradient
              id="vbMarkTile"
              x1="256"
              y1="0"
              x2="256"
              y2="512"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0" stopColor="#1c2126" />
              <stop offset="1" stopColor="#0b0d0e" />
            </linearGradient>
          </defs>
          <rect x="8" y="8" width="496" height="496" rx="116" fill="url(#vbMarkTile)" />
          <rect
            x="8.5"
            y="8.5"
            width="495"
            height="495"
            rx="115.5"
            fill="none"
            stroke="#ffffff"
            strokeOpacity="0.06"
          />
        </>
      )}
      {/* Second voice — offset, translucent */}
      <path
        d="M362 156 L268 352"
        stroke="currentColor"
        strokeOpacity="0.5"
        strokeWidth="56"
        strokeLinecap="round"
      />
      {/* First voice — bold accent */}
      <path d="M150 156 L244 352" stroke="currentColor" strokeWidth="56" strokeLinecap="round" />
      {/* Convergence point */}
      <circle cx="256" cy="372" r="20" fill="currentColor" />
    </svg>
  )
}
