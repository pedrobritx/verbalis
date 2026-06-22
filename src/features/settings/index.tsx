import { APP_VERSION, BUILD_SHA, BUILD_TIME } from '@/lib/version'
import { PageHeader } from '@/components/layout/PageHeader'
import { MTSettingsSection } from './MTSettingsSection'
import { SemanticTMSection } from './SemanticTMSection'
import { LookupSettingsSection } from './LookupSettingsSection'
import { EditorSettingsSection } from './EditorSettingsSection'
import { WebSearchSettingsSection } from './WebSearchSettingsSection'
import { SpellSettingsSection } from './SpellSettingsSection'
import { ProfileSettingsSection } from './ProfileSettingsSection'

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
      style={{
        borderColor: 'var(--color-border)',
        background: 'var(--color-surface)',
      }}
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

export default function SettingsPage() {
  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6">
      <PageHeader title="Settings" />

      <Section title="About">
        <Row label="Version" value={APP_VERSION} testId="settings-version" />
        <Row label="Build" value={BUILD_SHA} testId="settings-build-sha" />
        <Row label="Built at" value={BUILD_TIME} testId="settings-build-time" />
      </Section>

      <Section title="Identity">
        <ProfileSettingsSection />
      </Section>

      <MTSettingsSection />

      <Section title="Quick Lookup defaults">
        <LookupSettingsSection />
      </Section>

      <Section title="Editor &amp; quality assurance">
        <EditorSettingsSection />
      </Section>

      <Section title="Spell-check">
        <SpellSettingsSection />
      </Section>

      <Section title="Web search providers">
        <WebSearchSettingsSection />
      </Section>

      <SemanticTMSection />

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
