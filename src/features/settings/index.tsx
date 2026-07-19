import { useState } from 'react'
import {
  User,
  UserCog,
  Languages,
  PencilRuler,
  SpellCheck,
  Search,
  Brain,
  Info,
} from 'lucide-react'
import { APP_VERSION, BUILD_SHA, BUILD_TIME } from '@/lib/version'
import { PageHeader } from '@/components/layout/PageHeader'
import { cn } from '@/lib/utils'
import { isCloudConfigured } from '@/storage/cloud/supabaseClient'
import { MTSettingsSection } from './MTSettingsSection'
import { SemanticTMSection } from './SemanticTMSection'
import { LookupSettingsSection } from './LookupSettingsSection'
import { EditorSettingsSection } from './EditorSettingsSection'
import { WebSearchSettingsSection } from './WebSearchSettingsSection'
import { SpellSettingsSection } from './SpellSettingsSection'
import { ProfileSettingsSection } from './ProfileSettingsSection'
import { AccountSettingsSection } from '@/features/account/AccountSettingsSection'

function Row({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div className="flex items-center justify-between py-2 text-callout">
      <span style={{ color: 'var(--color-muted)' }}>{label}</span>
      <span
        className="font-mono tabular-nums"
        style={{ color: 'var(--color-text)' }}
        data-testid={testId}
      >
        {value}
      </span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      className="rounded-lg border p-5"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
    >
      <h2
        className="text-footnote font-semibold uppercase tracking-wider mb-3"
        style={{ color: 'var(--color-muted)' }}
      >
        {title}
      </h2>
      {children}
    </section>
  )
}

type SectionId =
  | 'identity'
  | 'account'
  | 'mt'
  | 'editor'
  | 'spell'
  | 'search'
  | 'semantic'
  | 'about'

const NAV: Array<{ id: SectionId; label: string; icon: React.ReactNode }> = [
  { id: 'identity', label: 'Identity', icon: <User size={15} /> },
  // Cloud accounts (3.2). Filtered out entirely on local-only deployments.
  { id: 'account', label: 'Account', icon: <UserCog size={15} /> },
  { id: 'mt', label: 'Machine translation', icon: <Languages size={15} /> },
  { id: 'editor', label: 'Editor & QA', icon: <PencilRuler size={15} /> },
  { id: 'spell', label: 'Spell-check', icon: <SpellCheck size={15} /> },
  { id: 'search', label: 'Search & lookup', icon: <Search size={15} /> },
  { id: 'semantic', label: 'Semantic TM', icon: <Brain size={15} /> },
  { id: 'about', label: 'About', icon: <Info size={15} /> },
]

function visibleNav() {
  return isCloudConfigured() ? NAV : NAV.filter((item) => item.id !== 'account')
}

function SectionContent({ id }: { id: SectionId }) {
  switch (id) {
    case 'identity':
      return (
        <Section title="Identity">
          <ProfileSettingsSection />
        </Section>
      )
    case 'account':
      return (
        <Section title="Account">
          <AccountSettingsSection />
        </Section>
      )
    case 'mt':
      return <MTSettingsSection />
    case 'editor':
      return (
        <Section title="Editor & quality assurance">
          <EditorSettingsSection />
        </Section>
      )
    case 'spell':
      return (
        <Section title="Spell-check">
          <SpellSettingsSection />
        </Section>
      )
    case 'search':
      return (
        <div className="flex flex-col gap-6">
          <Section title="Quick Lookup defaults">
            <LookupSettingsSection />
          </Section>
          <Section title="Web search providers">
            <WebSearchSettingsSection />
          </Section>
        </div>
      )
    case 'semantic':
      return <SemanticTMSection />
    case 'about':
      return (
        <div className="flex flex-col gap-6">
          <Section title="About">
            <Row label="Version" value={APP_VERSION} testId="settings-version" />
            <Row label="Build" value={BUILD_SHA} testId="settings-build-sha" />
            <Row label="Built at" value={BUILD_TIME} testId="settings-build-time" />
          </Section>
          <Section title="Offline">
            <p className="text-callout" style={{ color: 'var(--color-muted)' }}>
              Translation Memory and Glossary work fully offline. Wiktionary lookups are
              cached after first fetch. Ollama runs locally on your machine; Claude and
              LibreTranslate require network access.
            </p>
          </Section>
        </div>
      )
  }
}

export default function SettingsPage() {
  const [active, setActive] = useState<SectionId>('identity')
  const nav = visibleNav()

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6">
      <PageHeader title="Settings" />

      <div className="flex flex-col gap-4 md:grid md:grid-cols-[200px_minmax(0,1fr)] md:gap-6">
        {/* Section rail: vertical on desktop, horizontal scroller on mobile. */}
        <nav
          aria-label="Settings sections"
          data-testid="settings-nav"
          className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible md:sticky md:top-4 md:h-fit"
        >
          {nav.map((item) => {
            const isActive = active === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActive(item.id)}
                aria-current={isActive ? 'page' : undefined}
                data-testid={`settings-nav-${item.id}`}
                className={cn(
                  'flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm text-left transition-colors',
                  isActive ? 'font-semibold' : 'hover:bg-[var(--color-fill)]',
                )}
                style={{
                  background: isActive ? 'var(--color-surface)' : 'transparent',
                  color: isActive ? 'var(--color-text)' : 'var(--color-muted)',
                  border: `1px solid ${isActive ? 'var(--color-border)' : 'transparent'}`,
                }}
              >
                {item.icon}
                {item.label}
              </button>
            )
          })}
        </nav>

        <div className="min-w-0" data-testid={`settings-section-${active}`}>
          <SectionContent id={active} />
        </div>
      </div>
    </div>
  )
}
