import { APP_VERSION, BUILD_SHA, BUILD_TIME } from '@/lib/version'
import { MTSettingsSection } from './MTSettingsSection'
import { SemanticTMSection } from './SemanticTMSection'
import { LookupSettingsSection } from './LookupSettingsSection'

function Row({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div className="flex items-center justify-between py-1 text-sm">
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
      className="rounded-md border p-4"
      style={{
        borderColor: 'var(--color-border)',
        background: 'var(--color-surface)',
      }}
    >
      <h2 className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
        {title}
      </h2>
      {children}
    </section>
  )
}

export default function SettingsPage() {
  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-4">
      <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text)' }}>
        Settings
      </h1>

      <Section title="About">
        <Row label="Version" value={APP_VERSION} testId="settings-version" />
        <Row label="Build" value={BUILD_SHA} testId="settings-build-sha" />
        <Row label="Built at" value={BUILD_TIME} testId="settings-build-time" />
      </Section>

      <MTSettingsSection />

      <Section title="Quick Lookup defaults">
        <LookupSettingsSection />
      </Section>

      <SemanticTMSection />

      <Section title="Offline">
        <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
          Translation Memory and Glossary work fully offline. Wiktionary lookups are
          cached after first fetch. Ollama runs locally on your machine; Claude and
          LibreTranslate require network access.
        </p>
      </Section>
    </div>
  )
}
