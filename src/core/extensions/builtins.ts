import type { ExtensionManifest } from './types'
import { extensionRegistry } from './registry'
import { QA_CODES, QA_RULE_LABELS } from '@/core/qa/types'

/**
 * Built-in extension manifests (ROADMAP §6.1). The four MT providers are the
 * first capabilities re-expressed as manifests; QA rules, import/export formats,
 * and storage connectors follow in 6.2/6.3. Manifests are pure data — the actual
 * provider logic stays in `src/core/mt/*` and is paired to a manifest by the thin
 * wrappers in `src/extensions/mt`.
 */

/** Manifest ids for the four MT providers, matching `MT_EXTENSION_ID` in core/mt. */
export const MT_EXTENSION_MANIFESTS: ExtensionManifest[] = [
  {
    id: 'mt.mymemory',
    name: 'MyMemory',
    version: '1.0.0',
    kinds: ['mt-provider'],
    permissions: ['network'],
    builtIn: true,
    description: 'Free web translation-memory MT.',
  },
  {
    id: 'mt.libretranslate',
    name: 'LibreTranslate',
    version: '1.0.0',
    kinds: ['mt-provider'],
    permissions: ['network', 'credentials'],
    builtIn: true,
    description: 'Open-source MT (self-hosted or hosted API).',
  },
  {
    id: 'mt.ollama',
    name: 'Ollama',
    version: '1.0.0',
    kinds: ['mt-provider'],
    permissions: ['network'],
    builtIn: true,
    description: 'Local LLM translation via an Ollama server.',
  },
  {
    id: 'mt.claude',
    name: 'Claude',
    version: '1.0.0',
    kinds: ['mt-provider'],
    permissions: ['network', 'credentials'],
    builtIn: true,
    description: 'Anthropic Claude translation.',
  },
]

/** QA rules as addons (ROADMAP §6.2) — one manifest per rule so it can be
 *  toggled from the Add-ons page; disabling one drops it from QA output. */
export const QA_EXTENSION_MANIFESTS: ExtensionManifest[] = QA_CODES.map((code) => ({
  id: `qa.${code}`,
  name: QA_RULE_LABELS[code],
  version: '1.0.0',
  kinds: ['qa-rule'],
  permissions: [],
  builtIn: true,
  description: 'Quality-assurance check run over the project’s segments.',
}))

/** Import/export formats as addons (ROADMAP §6.2). Listed in the catalogue with
 *  their `filesystem` permission; the round-trip logic stays in core/*. */
export const FORMAT_EXTENSION_MANIFESTS: ExtensionManifest[] = [
  {
    id: 'format.xliff',
    name: 'XLIFF 1.2 (bilingual)',
    version: '1.0.0',
    kinds: ['import-format', 'export-format'],
    permissions: ['filesystem'],
    builtIn: true,
    description: 'Round-trip bilingual XLIFF from other CAT tools.',
  },
  {
    id: 'format.docx',
    name: 'Word (.docx)',
    version: '1.0.0',
    kinds: ['import-format', 'export-format'],
    permissions: ['filesystem'],
    builtIn: true,
    description: 'Import a Word document and export the clean translation.',
  },
  {
    id: 'format.tmx',
    name: 'TMX (translation memory)',
    version: '1.0.0',
    kinds: ['import-format', 'export-format'],
    permissions: ['filesystem'],
    builtIn: true,
    description: 'Exchange translation memory with other tools.',
  },
  {
    id: 'format.tbx',
    name: 'TBX (term base)',
    version: '1.0.0',
    kinds: ['import-format'],
    permissions: ['filesystem'],
    builtIn: true,
    description: 'Import terminology from a TBX term base.',
  },
  {
    id: 'format.csv',
    name: 'CSV (glossary)',
    version: '1.0.0',
    kinds: ['import-format', 'export-format'],
    permissions: ['filesystem'],
    builtIn: true,
    description: 'Import/export glossary terms as CSV.',
  },
]

/** Every built-in manifest, in catalogue order (MT, then QA, then formats). */
export const BUILTIN_MANIFESTS: ExtensionManifest[] = [
  ...MT_EXTENSION_MANIFESTS,
  ...QA_EXTENSION_MANIFESTS,
  ...FORMAT_EXTENSION_MANIFESTS,
]

let registered = false

/** Register every built-in manifest. Idempotent — safe to call on each startup. */
export function registerBuiltinExtensions(): void {
  if (registered) return
  registered = true
  for (const manifest of BUILTIN_MANIFESTS) extensionRegistry.register(manifest)
}

/** Test helper: allow re-registration after a registry reset. */
export function __resetBuiltinsForTest(): void {
  registered = false
}
