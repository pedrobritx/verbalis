import { Shield, Lock, Repeat, Scale, ArrowUpRight, User, Building2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { VerbalisMark } from '@/components/brand/VerbalisMark'
import {
  BRAND_LINKS,
  REPO_URL,
  LICENSE_URL,
  AUTHOR_NAME,
  AUTHOR_EMAIL,
} from './links'

export default function AboutPage() {
  return (
    <div className="flex flex-col gap-8 max-w-3xl mx-auto pb-8">
      <PageHeader title="About Verbalis" subtitle="Manifesto, license & credits" />

      {/* Brand lockup */}
      <section
        className="flex items-center gap-4 rounded-lg border p-5 sm:p-6"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
      >
        <VerbalisMark size={56} withTile />
        <div className="flex flex-col gap-1 min-w-0">
          <span
            className="text-title-3 font-semibold tracking-widest"
            style={{ color: 'var(--color-text)', fontFamily: 'var(--font-mono)' }}
          >
            VERBALIS
          </span>
          <span className="text-footnote" style={{ color: 'var(--color-muted)' }}>
            Local-first CAT tool for translators who can't afford to leak a sentence.
          </span>
        </div>
      </section>

      {/* Manifesto */}
      <section className="flex flex-col gap-3">
        <SectionTitle>Why Verbalis exists</SectionTitle>
        <div
          className="flex flex-col gap-4 text-body leading-relaxed"
          style={{ color: 'var(--color-text)' }}
        >
          <p>
            Verbalis started with a stubborn problem: I needed to translate
            sensitive, security-critical material and there was no tool I could
            fully trust. The mainstream options wanted my documents on their
            servers. The privacy-respecting ones couldn't speak the formats real
            translation work runs on — XLIFF, TMX, TBX — so they never fit a
            professional CAT workflow.
          </p>
          <p>
            So I built the tool I wanted: <strong>local-first by default</strong>{' '}
            — your files, translation memory and glossaries never leave your
            browser — yet <strong>fluent in the industry's interchange
            formats</strong>, so it slots into the same pipelines as memoQ,
            Trados and OmegaT.
          </p>
          <p style={{ color: 'var(--color-muted)' }}>
            Verbalis is a CAT tool for people who handle confidential text.
            Privacy here isn't a setting you toggle — it's the architecture.
          </p>
        </div>
      </section>

      {/* Principles */}
      <section className="flex flex-col gap-3">
        <SectionTitle>What that means in practice</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <Principle
            icon={<Lock size={18} />}
            title="Local-first"
            body="Files, TM and glossaries live in your browser (IndexedDB). Nothing is uploaded; it works fully offline as a PWA."
          />
          <Principle
            icon={<Shield size={18} />}
            title="Built for confidential work"
            body="Designed for security-sensitive translation where source text simply cannot leave the machine."
          />
          <Principle
            icon={<Repeat size={18} />}
            title="Industry interoperable"
            body="Round-trips XLIFF 1.2, TMX, TBX, OmegaT and MultiTerm so it drops into existing CAT pipelines."
          />
          <Principle
            icon={<Scale size={18} />}
            title="Source-available"
            body="Free for individuals with attribution. Read, fork and learn from the source on GitHub."
          />
        </div>
      </section>

      {/* License */}
      <section className="flex flex-col gap-3">
        <SectionTitle>License</SectionTitle>
        <div
          className="rounded-lg border p-5 flex flex-col gap-4"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
        >
          <p className="text-callout" style={{ color: 'var(--color-muted)' }}>
            Verbalis is <strong style={{ color: 'var(--color-text)' }}>source-available</strong>{' '}
            — the code is public to read and learn from, under a two-tier license:
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <LicenseTier
              icon={<User size={18} />}
              tier="Individuals — free"
              body="Use it for your own work at no cost. The only rule: credit the developer and keep the link back to the project."
            />
            <LicenseTier
              icon={<Building2 size={18} />}
              tier="Organizations — get in touch"
              body="Any team or company larger than one person needs a commercial license. Pricing is set individually and fairly."
            />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
            <ExternalLink href={LICENSE_URL}>Read the full license</ExternalLink>
            <ExternalLink href={`mailto:${AUTHOR_EMAIL}`}>
              Contact for commercial use
            </ExternalLink>
          </div>
        </div>
      </section>

      {/* Links */}
      <section className="flex flex-col gap-3">
        <SectionTitle>Project & author</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          {BRAND_LINKS.map(({ label, description, href, icon: Icon }) => (
            <a
              key={href}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-3 rounded-md border px-4 py-3 min-h-hit transition-colors hover:bg-[var(--color-fill)]"
              style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
            >
              <span
                className="inline-flex items-center justify-center w-9 h-9 rounded-md shrink-0"
                style={{ background: 'var(--color-accent-fill)', color: 'var(--color-accent)' }}
              >
                <Icon size={18} />
              </span>
              <span className="flex flex-col min-w-0 flex-1">
                <span className="text-callout font-medium" style={{ color: 'var(--color-text)' }}>
                  {label}
                </span>
                <span className="text-footnote truncate" style={{ color: 'var(--color-muted)' }}>
                  {description}
                </span>
              </span>
              <ArrowUpRight
                size={16}
                className="shrink-0 opacity-50 transition-opacity group-hover:opacity-100"
                style={{ color: 'var(--color-muted)' }}
              />
            </a>
          ))}
        </div>
      </section>

      <p className="text-footnote text-center" style={{ color: 'var(--color-subtle)' }}>
        Created by{' '}
        <a
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2"
          style={{ color: 'var(--color-muted)' }}
        >
          {AUTHOR_NAME}
        </a>
        . Made for translators who keep secrets.
      </p>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-title-3 font-semibold" style={{ color: 'var(--color-text)' }}>
      {children}
    </h2>
  )
}

function Principle({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode
  title: string
  body: string
}) {
  return (
    <div
      className="flex flex-col gap-2 rounded-md border p-4"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
    >
      <div className="flex items-center gap-2">
        <span style={{ color: 'var(--color-accent)' }}>{icon}</span>
        <h3 className="text-callout font-semibold" style={{ color: 'var(--color-text)' }}>
          {title}
        </h3>
      </div>
      <p className="text-footnote" style={{ color: 'var(--color-muted)' }}>
        {body}
      </p>
    </div>
  )
}

function LicenseTier({
  icon,
  tier,
  body,
}: {
  icon: React.ReactNode
  tier: string
  body: string
}) {
  return (
    <div
      className="flex flex-col gap-2 rounded-md border p-4"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}
    >
      <div className="flex items-center gap-2">
        <span style={{ color: 'var(--color-accent)' }}>{icon}</span>
        <h3 className="text-footnote font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text)' }}>
          {tier}
        </h3>
      </div>
      <p className="text-footnote" style={{ color: 'var(--color-muted)' }}>
        {body}
      </p>
    </div>
  )
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-callout font-medium underline-offset-4 hover:underline"
      style={{ color: 'var(--color-accent)' }}
    >
      {children}
      <ArrowUpRight size={15} />
    </a>
  )
}
