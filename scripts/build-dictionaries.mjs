#!/usr/bin/env node
// Copy the bundled Hunspell dictionaries (affix + dictionary files) that ship
// with Verbalis for on-device spell-checking into public/dictionaries/<lang>/,
// where they are fetched on demand and cached by the service worker (like the
// bundled corpora). Source data comes from the wooorm `dictionary-*` dev
// dependencies so we never re-vendor the word lists by hand.
//
//   node scripts/build-dictionaries.mjs
//
// Re-run after adding a language below or bumping a dictionary package.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')
const require = createRequire(import.meta.url)
const outRoot = join(repoRoot, 'public/dictionaries')

// Dictionary key (see resolveSpellLang in src/core/spell/dictionaries.ts) -> npm
// package. `dictionary-en` is American English and `dictionary-pt` is Brazilian
// Portuguese (per wooorm); the regional variants are shipped alongside so a
// project targeting en-GB or pt-PT gets the right spelling, not a fallback.
const LANGS = {
  en: 'dictionary-en', // American English
  'en-GB': 'dictionary-en-gb', // British English
  pt: 'dictionary-pt', // Brazilian Portuguese
  'pt-PT': 'dictionary-pt-pt', // European Portuguese
}

const manifest = []

for (const [lang, pkg] of Object.entries(LANGS)) {
  // Resolve the package's index.aff next to its main entry (index.js).
  const pkgDir = dirname(require.resolve(pkg))
  const aff = readFileSync(join(pkgDir, 'index.aff'))
  const dic = readFileSync(join(pkgDir, 'index.dic'))

  const dir = join(outRoot, lang)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'index.aff'), aff)
  writeFileSync(join(dir, 'index.dic'), dic)

  const dicWords = dic.toString('utf8').split('\n')[0].trim()
  manifest.push({ lang, source: pkg, words: Number(dicWords) || undefined })
  console.log(`  ${lang}: ${pkg} (aff ${aff.length}B, dic ${dic.length}B)`)
}

mkdirSync(outRoot, { recursive: true })
writeFileSync(join(outRoot, 'manifest.json'), JSON.stringify({ dictionaries: manifest }, null, 2))
console.log(`Wrote ${manifest.length} dictionaries + manifest to public/dictionaries/`)
