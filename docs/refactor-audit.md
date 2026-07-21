# Verbalis — Repository Audit & Refactor Plan

_Last reviewed: 2026-07-21 · against `main` @ PR #66 (revamp Milestone 6 complete)_

A consolidation/polish pass now that the six-milestone "Translation IDE" revamp
has landed. This document is the scan the maintainer asked for: an honest health
snapshot, the safe fixes shipped alongside it, and a prioritized backlog of
everything else — so the rest can be picked up one slice at a time.

---

## 1. Executive summary

**Verbalis is in excellent health.** ~30,900 lines across 309 TS/TSX files, a
clean feature/core/storage separation, `tsc -b` passes, and **717/717 unit tests
+ ~29 e2e tests are green**. There are **zero** `TODO`/`FIXME`/`HACK` markers,
only 5 `console.*` calls, and disciplined code-splitting keeps the optional
cloud/AI/DOCX code out of the initial bundle. This is not a codebase that needs
rescuing — it needs *organising and finishing touches*.

The findings below are therefore mostly **polish, tooling, and documentation**,
not structural rework. They are ranked by value ÷ risk so the highest-leverage,
lowest-danger items come first.

### Health snapshot

| Signal | Value | Notes |
|---|---|---|
| Source size | ~30,900 LOC / 309 files | Well-factored |
| Unit tests | 717 passing / 118 files | Excellent coverage of `core/*` + `storage/*` |
| E2E tests | ~29 (Playwright) | Cover the real user journeys |
| Typecheck | ✅ clean | Strict mode |
| `TODO`/`FIXME`/`HACK` | 0 | — |
| `console.*` | 5 | Acceptable; a couple could be dropped |
| `any` / `ts-ignore` | 22 | Mostly legit (markdown/docx AST walkers) |
| Dexie schema | v7 | Migrations are additive & tested |
| Linter | ❌ none | See §3.1 |
| Bundler | Vite 6, aggressive lazy chunks | Cloud/AI/DOCX all code-split |

---

## 2. Shipped in this pass

Small, safe, high-value changes made directly (all green under typecheck + unit
tests):

- **README** — fixed the "Website" link (pointed at a different project) to the
  live app, corrected the stale commercial-contact email to the canonical one
  used in-app (`src/features/about/links.ts`), and documented the completed
  revamp feature set (tracked changes, collaboration, roles, connectors) that
  the README previously never mentioned.
- **`index.html`** — added Open Graph + Twitter Card + canonical + keyword meta
  and a light/dark `theme-color`, so shared links and PWA installs render
  properly. (An OG **image** is still a follow-up — see §3.3.)
- **Welcome screen** — the first-run screen (what a new visitor to
  `verbalis.britx.me` actually lands on) is now a proper hero: brand mark, value
  proposition, four benefit cards (privacy / offline / formats / smart assist),
  the three-step flow, and clear CTAs — all in the existing design tokens.
- **Theming bug** — the sidebar and status-filter "active" background hardcoded
  the **dark-theme** accent (`rgba(0,194,204,0.08)`) in four places, so it did
  not adapt in light mode. Replaced with a new `--color-accent-subtle` token
  (defined per theme in `tokens.css`).
- **Sidebar dedup** — three copy-pasted `NavLink` blocks collapsed into one
  `SidebarLink` component (single source of truth for active styling).
- **Breadcrumb** — `TopBar` `ROUTE_LABELS` was missing `/corpora`, `/addons`,
  `/guide`, `/about`, so the top-bar breadcrumb showed the raw path. Completed.
- **`architecture.md`** — the storage-schema table was frozen at v3; refreshed
  to the real v7 schema and cross-linked to the revamp record.

---

## 3. Backlog — prioritized

### P1 — high value, low risk

**3.1 Add a linter (and wire it into CI).**
There is no ESLint config, no `lint` script, and no eslint dependency. The code
is consistent today (clearly hand-disciplined), but nothing *enforces* it — no
guard against unused vars/imports, `react-hooks/exhaustive-deps` mistakes,
floating promises, or accidental `console.log`s. Add a flat-config ESLint
(`typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`)
plus a `pnpm lint` step in `ci.yml`. Low risk, compounding value.

**3.2 Pin the package manager.**
`package.json` has no `packageManager` field, and its `pnpm.onlyBuiltDependencies`
lives in the location **pnpm 11 no longer reads** (it warns and ignores it), while
CI pins `pnpm/action-setup@v3` to v9. So a fresh local checkout (corepack → pnpm
11) and CI (pnpm 9) resolve builds differently. Add `"packageManager": "pnpm@9.x"`
(matching CI) and move `onlyBuiltDependencies` to `pnpm-workspace.yaml` if you
bump to pnpm ≥10. Reconcile the two workflow files at the same time (action-setup
warns if both `version:` and `packageManager` are set).

**3.3 Ship a real Open Graph image.**
The new meta references `icons/icon-512.png` (square) as the share image. A
purpose-built 1200×630 card (`public/og.png`, referenced absolutely) would make
links look intentional on LinkedIn/Slack/X. Small design task.

**3.4 Consolidate the docs (the "wiki").**
`docs/` is thorough but now mixes three eras (see §4). Recommendation: keep
`architecture.md` + `cloud.md` as the living reference, fold the revamp
`ROADMAP`/`STATUS` into a short "history" note, and either delete or clearly mark
`docs/revamp/prompts/` (build scaffolding, 30 files) and the pre-revamp
`docs/vision/*` + `roadmap-professional-features.md` as historical. A short
`docs/README.md` index (or a GitHub Wiki mirror) would make the set navigable.

### P2 — medium value

**3.5 Decompose the three largest components.**
`EditorPage.tsx` (708), `SegmentRow.tsx` (597) and `TranslateWorkspace.tsx` (497)
are the only files that meaningfully exceed the ~300-line norm. None are broken,
but they carry a lot of state and effects; extracting sub-hooks
(`useEditorKeyboard`, `useSegmentActions`, …) and presentational sub-components
would improve testability and review speed. Do this incrementally, one panel/hook
per PR, behind the existing e2e coverage.

**3.6 Add dead-code / dependency detection.**
No automated check exists for unused exports, files, or dependencies. Add
[`knip`](https://knip.dev) as a `pnpm knip` step. Expect a small first-run
cleanup (barrel re-exports like `features/translation/index.tsx`, any orphaned
helpers) and ongoing protection.

**3.7 Quiet the bundle-size warning (cosmetic).**
`vite build` warns about a >500 kB chunk. It is **not** the entry — it is the
opt-in on-device ML stack (`onnxruntime-web` ~1.7 MB + `transformers` ~812 kB),
correctly split into lazy chunks that only load when a user enables semantic TM;
the initial bundle stays ~120 kB gzip. The code-splitting is doing its job. If
the warning is noise, either raise `build.chunkSizeWarningLimit` or add explicit
`manualChunks` for `onnxruntime-web`/`transformers` — a cosmetic tidy, not a real
regression.

**3.8 Tighten the remaining `any`s.**
The 22 `any`/`ts-ignore` sites are concentrated in `core/documents/toDocx.ts` and
`features/guide/Markdown.tsx` (AST walkers). Most can take a real `mdast`/`docx`
node type. Not urgent, but it removes the last untyped seams.

**3.9 Accessibility & UX polish.**
- The theme toggle and several icon buttons rely on `aria-label` only — good, but
  a visible focus ring audit across the new hero + cards is worth one pass.
- Consider `prefers-reduced-motion` for the sidebar/topbar transitions (the CSS
  reset covers animations globally, but the inline `transition-*` styles bypass
  it).
- The command palette (`Ctrl/⌘+K`) is the power surface — surface it more visibly
  in the welcome hero for discoverability.

### P3 — larger / strategic (maintainer's call)

**3.10 A dedicated marketing landing page.**
Today the app *is* the landing page (Excalidraw-style), and the elevated welcome
hero now serves that well for first-run. If you want SEO/marketing reach (feature
tour, screenshots, pricing, testimonials) without loading the app, a separate
static route or a small companion site is the way — but it is a product decision,
not a refactor.

**3.11 Desktop (Tauri) follow-through.** The `src-tauri/` scaffold + mDNS LAN
transport are documented but outside CI. Finishing the desktop peer story is the
roadmap tail.

**3.12 MT enhancements.** Streaming responses and "translate all empty segments"
were explicitly deferred (see `architecture.md` Phase 6). Natural next addons.

---

## 4. Documentation inventory

| Path | Role | Recommendation |
|---|---|---|
| `README.md` | Front door | ✅ refreshed this pass |
| `docs/architecture.md` | Living architecture | ✅ refreshed; keep current |
| `docs/cloud.md` | Cloud/signed-in setup | Living; keep |
| `docs/refactor-audit.md` | This file | Living backlog |
| `docs/revamp/ROADMAP.md` + `STATUS.md` | Revamp record | Keep as history; link from architecture |
| `docs/revamp/prompts/*` (30 files) | Build scaffolding | Archive or delete — served their purpose |
| `docs/vision/*` (6 files) | Pre-build product vision | Mark historical; superseded by shipped app |
| `docs/roadmap-professional-features.md` | Pre-revamp plan | Mark historical; largely delivered |

The revamp is done, so several planning docs are now historical rather than
directive. Nothing here is *wrong* — it just needs a clear "this was the plan /
this is the current state" boundary so a newcomer isn't misled.

---

## 5. What is deliberately good (don't "fix" it)

- **Inline `style={{ ... var(--color-*) }}` + Tailwind for layout.** 650+ sites,
  but it's a consistent, intentional theming system (CSS custom properties drive
  light/dark). Not tech debt.
- **Additive, env-gated cloud.** The signed-in code genuinely tree-shakes out
  when unconfigured (verified repeatedly in `STATUS.md`). Don't collapse the
  seams that make this possible.
- **The per-segment Lexical contract** ("Lexical state is truth, `richStateToPlain`
  derives plain `target`"). Load-bearing; every tracked-change/comment/CRDT
  feature depends on it. Refactors near `core/editor/richText.ts` need care.
- **Pure `core/*` with injected `fetchImpl`/clients.** Why the test suite is so
  strong. Keep new logic pure and push I/O to the edges.

---

_This audit is intentionally conservative: it ships only what is safe to ship
unattended and leaves judgement calls (marketing page, component splits, tooling
choices) as clearly-scoped tickets for the maintainer to sequence._
