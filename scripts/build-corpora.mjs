#!/usr/bin/env node
// Build the bundled PT->EN legal/economic terminology corpora that ship with
// Verbalis. Reads the consolidated termbase CSV (pt,en,domain,source,note),
// classifies each pair into a curated field/area, and writes one compact JSON
// pack per field plus a manifest, into public/corpora/.
//
//   node scripts/build-corpora.mjs [inputCsv] [outDir]
//
// Defaults: scripts/data/master_glossary.csv -> public/corpora/
//
// Re-run after editing scripts/data/master_glossary.csv or the FIELDS rules
// below. The classification is keyword-heuristic by design: the bulk of the
// general legal termbase falls through to the "general-legal" catch-all, while
// the curated fields skim off the recognisable subsets so users can install
// terminology by area.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')

const inputCsv = process.argv[2]
  ? resolve(process.argv[2])
  : join(repoRoot, 'scripts/data/master_glossary.csv')
const outDir = process.argv[3] ? resolve(process.argv[3]) : join(repoRoot, 'public/corpora')

const LANG_SOURCE = 'pt'
const LANG_TARGET = 'en'

// ---- CSV parsing (RFC-4180-ish: quotes, embedded commas/newlines, "") -------
function parseCsv(text) {
  const rows = []
  let row = []
  let cell = ''
  let q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i++
        } else q = false
      } else cell += c
      continue
    }
    if (c === '"') {
      q = true
      continue
    }
    if (c === ',') {
      row.push(cell)
      cell = ''
      continue
    }
    if (c === '\r') {
      if (text[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      continue
    }
    if (c === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      continue
    }
    cell += c
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ''))
}

// ---- Field taxonomy ---------------------------------------------------------
// Priority order matters: the first matching rule wins. Competition is keyed off
// the source domain (it is literally the CADE competition-law corpus); the rest
// match keyword sets against the combined pt+en text (lowercased, accents kept).
const FIELDS = [
  {
    id: 'competition',
    label: 'Competition & Antitrust',
    description:
      'CADE competition law: cartels, merger control, leniency, abuse of dominance, antitrust enforcement.',
    domain: 'competition',
    keywords: [
      'antitrust',
      'cartel',
      'leniency',
      'leniência',
      'merger control',
      'concorrência',
      'concorrencial',
      'concentração',
      'truste',
      'monopól',
      'abuso de posição',
      'posição dominante',
      'dumping',
      'cade',
      'defesa da concorrência',
    ],
  },
  {
    id: 'tax',
    label: 'Tax',
    description: 'Tax and fiscal terminology: direct and indirect taxes, withholding, tax procedure.',
    keywords: [
      'taxation',
      'taxable',
      'taxpayer',
      'withholding tax',
      'tributár',
      'tributo',
      'imposto',
      'icms',
      'ipi',
      ' iss ',
      'imposto de renda',
      'fiscal',
      'fazendári',
      'contribuição social',
      'isenção fiscal',
      'crédito tributário',
    ],
  },
  {
    id: 'ip',
    label: 'Intellectual Property',
    description: 'Trademarks, patents, copyright, industrial and intellectual property.',
    keywords: [
      'trademark',
      'patent',
      'copyright',
      'royalt',
      'marca registrada',
      'patente',
      'propriedade intelectual',
      'propriedade industrial',
      'direito autoral',
      'direitos autorais',
      'desenho industrial',
      'inpi',
    ],
  },
  {
    id: 'labour',
    label: 'Labour & Employment',
    description: 'Employment law, labour courts, CLT, social security and workplace terminology.',
    keywords: [
      'labour',
      'labor court',
      'employment',
      'employee',
      'employer',
      'trabalhist',
      ' clt',
      'fgts',
      'rescisão',
      'empregad',
      'sindicat',
      'salári',
      'previdenc',
      'aviso prévio',
      'jornada de trabalho',
    ],
  },
  {
    id: 'corporate',
    label: 'Corporate & M&A',
    description: 'Company law, shareholders, corporate governance, mergers, acquisitions and restructuring.',
    keywords: [
      'shareholder',
      'corporate',
      'sociedade anônima',
      'sociedade limitada',
      'acionist',
      'quotas',
      'quotista',
      'estatuto social',
      'assembleia geral',
      'diretoria',
      'conselho de administração',
      'incorporação',
      'cisão',
      'capital social',
      'controladora',
      'subsidiári',
      'holding',
      'debênture',
    ],
  },
  {
    id: 'accounting-finance',
    label: 'Accounting & Finance',
    description: 'Accounting, auditing, financial statements, banking and capital-markets terminology.',
    keywords: [
      'accounting',
      'balance sheet',
      'depreciation',
      'amortization',
      'cash flow',
      'audit',
      'contábil',
      'contabilidade',
      'balanço',
      'demonstração financeira',
      'demonstrações contábeis',
      'patrimônio líquido',
      'auditoria',
      'dividendo',
      'fluxo de caixa',
      'ativo circulante',
      'passivo',
      'provisão',
    ],
  },
  {
    id: 'criminal',
    label: 'Criminal Law',
    description: 'Criminal law and procedure: offences, penalties, prosecution and the penal code.',
    keywords: [
      'criminal',
      'felony',
      'misdemeanour',
      'penal',
      'homicíd',
      'furto',
      'roubo',
      ' dolo',
      'culpa grave',
      'pena privativa',
      'flagrante',
      'denúncia',
      'réu',
      'delito',
    ],
  },
  {
    id: 'civil-procedure',
    label: 'Civil Procedure & Litigation',
    description: 'Court procedure, pleadings, appeals, injunctions, judgments and enforcement.',
    keywords: [
      'lawsuit',
      'plaintiff',
      'defendant',
      'injunction',
      'judgment',
      'appeal',
      'pleading',
      'petição',
      'recurso',
      'mandado de segurança',
      'liminar',
      'sentença',
      'acórdão',
      'agravo',
      'embargos',
      'citação',
      'execução',
      'juízo',
      'vara cível',
      'tutela',
    ],
  },
  {
    id: 'academic',
    label: 'Academic & Scholarly',
    description: 'Academic writing, citation (ABNT/NBR), theses and scholarly apparatus.',
    keywords: [
      'abstract',
      'thesis',
      'dissertation',
      'scholarly',
      'abnt',
      ' nbr',
      'resumo',
      'dissertação',
      'monografia',
      ' tese',
      'artigo científico',
      'referências bibliográficas',
      'periódico',
    ],
  },
  {
    id: 'contracts',
    label: 'Contracts & Obligations',
    description: 'Contract drafting and the law of obligations: clauses, leases, guarantees, performance.',
    keywords: [
      'contract',
      'agreement',
      'clause',
      'lease',
      'covenant',
      'indemnit',
      'contrato',
      'cláusula',
      'locação',
      'arrendamento',
      'comodato',
      'obrigaç',
      'inadimpl',
      'rescisão contratual',
      'fiança',
      'garantia contratual',
    ],
  },
  {
    id: 'general-legal',
    label: 'General Legal',
    description:
      'Broad Brazilian legal terminology not specific to a single field — the catch-all corpus.',
    keywords: [], // fallback
  },
]

function classify(pt, en, domain) {
  const hay = ` ${pt.toLowerCase()} || ${en.toLowerCase()} `
  for (const f of FIELDS) {
    if (f.domain && domain && domain.includes(f.domain)) return f.id
    if (f.keywords.length === 0) return f.id // fallback
    for (const kw of f.keywords) {
      if (hay.includes(kw)) return f.id
    }
  }
  return 'general-legal'
}

// ---- Build ------------------------------------------------------------------
const raw = readFileSync(inputCsv, 'utf-8')
const rows = parseCsv(raw)
const header = rows[0].map((h) => h.trim().toLowerCase())
const ptIdx = header.indexOf('pt')
const enIdx = header.indexOf('en')
const domIdx = header.indexOf('domain')
const srcIdx = header.indexOf('source')
const noteIdx = header.indexOf('note')
if (ptIdx === -1 || enIdx === -1) {
  throw new Error('CSV must have pt and en columns')
}

const buckets = new Map() // fieldId -> { terms: [[pt,en,source,note]], sources: {} }
for (const f of FIELDS) buckets.set(f.id, { terms: [], sources: {} })

let total = 0
const seen = new Set() // dedupe identical pt|en pairs globally
for (let i = 1; i < rows.length; i++) {
  const r = rows[i]
  const pt = (r[ptIdx] ?? '').trim()
  const en = (r[enIdx] ?? '').trim()
  if (!pt || !en) continue
  const domain = domIdx === -1 ? '' : (r[domIdx] ?? '').trim()
  const source = (srcIdx === -1 ? '' : (r[srcIdx] ?? '').trim()) || 'unknown'
  const note = noteIdx === -1 ? '' : (r[noteIdx] ?? '').trim()
  const key = `${pt.toLowerCase()}${en.toLowerCase()}`
  if (seen.has(key)) continue
  seen.add(key)
  const fieldId = classify(pt, en, domain)
  const b = buckets.get(fieldId)
  b.terms.push([pt, en, source, note])
  b.sources[source] = (b.sources[source] ?? 0) + 1
  total++
}

mkdirSync(outDir, { recursive: true })

const packsMeta = []
for (const f of FIELDS) {
  const b = buckets.get(f.id)
  if (b.terms.length === 0) continue
  const file = `${f.id}.json`
  const packFile = {
    id: f.id,
    langSource: LANG_SOURCE,
    langTarget: LANG_TARGET,
    terms: b.terms,
  }
  writeFileSync(join(outDir, file), JSON.stringify(packFile))
  packsMeta.push({
    id: f.id,
    label: f.label,
    description: f.description,
    count: b.terms.length,
    sources: b.sources,
    file,
  })
}

const manifest = {
  version: 1,
  generatedAt: new Date().toISOString(),
  langSource: LANG_SOURCE,
  langTarget: LANG_TARGET,
  total,
  packs: packsMeta,
}
writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2))

// Report
console.log(`Parsed ${total} unique PT->EN pairs into ${packsMeta.length} field packs:`)
for (const p of packsMeta) {
  const srcs = Object.entries(p.sources)
    .map(([k, v]) => `${k}:${v}`)
    .join(', ')
  console.log(`  ${p.id.padEnd(20)} ${String(p.count).padStart(6)}  (${srcs})`)
}
console.log(`Wrote ${packsMeta.length} packs + manifest.json to ${outDir}`)
