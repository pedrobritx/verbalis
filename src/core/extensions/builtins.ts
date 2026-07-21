import type { ExtensionManifest } from './types'
import { extensionRegistry } from './registry'

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

let registered = false

/** Register every built-in manifest. Idempotent — safe to call on each startup. */
export function registerBuiltinExtensions(): void {
  if (registered) return
  registered = true
  for (const manifest of MT_EXTENSION_MANIFESTS) extensionRegistry.register(manifest)
}

/** Test helper: allow re-registration after a registry reset. */
export function __resetBuiltinsForTest(): void {
  registered = false
}
