import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Verbalis design tokens (used via CSS custom properties)
        'vb-bg': 'var(--color-bg)',
        'vb-surface': 'var(--color-surface)',
        'vb-elevated': 'var(--color-elevated)',
        'vb-border': 'var(--color-border)',
        'vb-divider': 'var(--color-divider)',
        'vb-text': 'var(--color-text)',
        'vb-muted': 'var(--color-muted)',
        'vb-subtle': 'var(--color-subtle)',
        'vb-accent': 'var(--color-accent)',
        'vb-accent-fill': 'var(--color-accent-fill)',
        'vb-fill': 'var(--color-fill)',
        'vb-fill-2': 'var(--color-fill-secondary)',
        'vb-confirm': 'var(--color-confirm)',
        'vb-warning': 'var(--color-warning)',
        'vb-error': 'var(--color-error)',
        // shadcn CSS variable mapping
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      },
      fontSize: {
        'large-title': [
          'var(--text-large-title)',
          { lineHeight: 'var(--leading-large-title)', letterSpacing: '-0.022em' },
        ],
        'title-1': [
          'var(--text-title-1)',
          { lineHeight: 'var(--leading-title-1)', letterSpacing: '-0.02em' },
        ],
        'title-2': [
          'var(--text-title-2)',
          { lineHeight: 'var(--leading-title-2)', letterSpacing: '-0.015em' },
        ],
        'title-3': [
          'var(--text-title-3)',
          { lineHeight: 'var(--leading-title-3)', letterSpacing: '-0.01em' },
        ],
        headline: ['var(--text-headline)', { lineHeight: 'var(--leading-headline)' }],
        body: ['var(--text-body)', { lineHeight: 'var(--leading-body)' }],
        callout: ['var(--text-callout)', { lineHeight: 'var(--leading-callout)' }],
        subhead: ['var(--text-subhead)', { lineHeight: 'var(--leading-subhead)' }],
        footnote: ['var(--text-footnote)', { lineHeight: 'var(--leading-footnote)' }],
        caption: ['var(--text-caption)', { lineHeight: 'var(--leading-caption)' }],
      },
      spacing: {
        hit: 'var(--hit-min)',
      },
      minHeight: {
        hit: 'var(--hit-min)',
      },
      minWidth: {
        hit: 'var(--hit-min)',
      },
      fontFamily: {
        ui: ['Geist', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
