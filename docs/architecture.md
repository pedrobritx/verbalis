# VERBALIS — Architecture

## Overview

VERBALIS is a local-first, browser-native CAT (Computer-Assisted Translation) tool. It runs entirely as a static site with no server, no backend, and no account requirement. User data stays in IndexedDB on the device.

## Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | React 18 + TypeScript | Strict mode, full type safety |
| Bundler | Vite 6 | base: '/' for the custom-domain root (override with VITE_BASE_PATH for subdirectory builds) |
| Styling | Tailwind CSS 3 + shadcn/ui | Owned components, Radix primitives |
| State | Zustand (UI) + TanStack Query v5 (async) | No Redux boilerplate |
| Routing | React Router v6 HashRouter | GH Pages SPA compatibility |
| Storage | Dexie.js v4 (IndexedDB) | Promise API, live hooks, migrations |
| Parsing | unified + remark-parse + remark-gfm + sbd | AST-based, not regex |
| DOCX | mammoth | Only viable browser-side parser |
| Fuzzy search | Fuse.js (TM) + MiniSearch (terminology) | Different tools for different jobs |
| Workers | Comlink | Makes Web Worker calls look like async functions |
| PWA | vite-plugin-pwa (Workbox) | Offline support, installable |
| Fonts | geist npm package | Self-hosted, works fully offline |

## Key Folder Map

```
src/
├── app/          — Router, providers, root component
├── components/
│   ├── ui/       — shadcn primitives (owned, not a dependency)
│   └── layout/   — AppShell, Sidebar, TopBar
├── features/     — One directory per domain feature
├── core/
│   ├── types/    — Shared TypeScript interfaces
│   └── ...       — Segmentation, parsing, shortcuts logic
├── storage/
│   ├── db.ts     — Dexie instance (single source of truth)
│   └── repositories/ — Data access layer
└── workers/      — Web Workers via Comlink
```

## Storage Schema (v3)

| Table | Indexes |
|---|---|
| projects | id, name, updatedAt |
| segments | id, projectId, index, status |
| tm | id, source, sourceLang, targetLang, projectId, corpusId |
| glossary | id, term, projectId |
| settings | &key |
| embeddings | id, tmId, model, [tmId+model] |
| corpusTerms | id, corpusId |
| corpusPacks | id |

Migrations are handled by Dexie's versioning system (`this.version(N).stores(...)`). Always increment, never modify existing version blocks. v3 adds the bundled-corpora tables and a `corpusId` index on `tm` (so TM entries seeded from a corpus can be removed when the pack is uninstalled).

## Deployment

Static build → GitHub Actions → GitHub Pages at `https://verbalis.britx.me/`.

Critical GH Pages constraints:
- `base: '/' (override with VITE_BASE_PATH for subdirectory builds)` in vite.config.ts
- `HashRouter` (not BrowserRouter) — no server-side routing on GH Pages
- PWA `start_url: "."` and `scope: "."` — relative paths required

## Command Palette & Review Modes (Phase 4)

A global `CommandPalette` (cmdk-based) is mounted in `src/app/App.tsx` and opened with `Ctrl+K` / `⌘K`. It exposes navigation, theme toggle, the global Import dialog, and — when on `/project/:id` — editor actions: toggle review mode, mark current segment reviewed, jump-to-status, status filter. Two small Zustand stores back it: `useCommandPaletteStore` (open state) and `useEditorActionsStore` (the editor exposes its current actions here so the palette can call into it without prop drilling). Editor-mode state (`reviewMode`, `statusFilter`) lives in `useEditorModeStore`. Reviewer keystroke: `Ctrl+Shift+Enter` on a segment toggles between `translated` and `reviewed`. `Ctrl+Shift+R` toggles review mode globally.

DOCX import uses `mammoth.convertToHtml`, then a small DOM walker (`src/core/segmentation/docx.ts`) maps the HTML tree back to the same `ParsedSegment` shape used for TXT/MD. The walker stays on the main thread because mammoth depends on JSZip + DOMParser; the existing parsing worker remains TXT/MD-only.

## Phase Roadmap

| Phase | Scope |
|---|---|
| 0 | Foundation — scaffold, CI/CD, PWA, app shell ✅ |
| 1 | TXT + MD import, segmentation, side-by-side editor ✅ |
| 2 | Translation Memory — store, exact/fuzzy match, TMX import/export ✅ |
| 3 | Terminology — glossary CRUD, CSV + TBX I/O, inline editor panel, Wiktionary adapter ✅ |
| 4 | DOCX import, command palette, review modes ✅ |
| 5 | PWA hardening, offline edge cases, update notification ✅ |
| 6 | AI integrations (Ollama, Claude, LibreTranslate), semantic TM ✅ |
| 7+ | Project-level exports, terminology extraction, collaborative TM |
| 8+ | Professional CAT features — rich editor, segment handling, versioning, LAN collaboration, document standards. See [`roadmap-professional-features.md`](roadmap-professional-features.md) |

## Phase 5 — PWA Layer

Verbalis is installable and works fully offline once the service worker has cached the shell. Phase 5 turns three latent stubs into real behaviour and hardens the one network-dependent feature (Wiktionary).

- **Update notification (prompt mode)**. `vite-plugin-pwa` is configured with `registerType: 'prompt'` so a new build is not auto-applied — `src/pwa/register.ts` wires `onNeedRefresh` into a Zustand store (`src/pwa/usePwaStore.ts`) and `src/pwa/UpdateBanner.tsx` renders a fixed banner with "Reload" and "Later". Reload calls the `updateSW(true)` function returned by `registerSW`, which triggers `skipWaiting` + page reload. This keeps in-flight textarea edits safe.
- **First-run offline-ready toast**. `onOfflineReady` flips the same store; `src/pwa/OfflineReadyToast.tsx` shows a one-shot "ready to work offline" toast gated by `localStorage` (`verbalis.pwa.offlineReadyAck`). The ack key is cleared whenever `onNeedRefresh` fires so a post-update install re-confirms.
- **Online/offline awareness**. `src/hooks/useNetworkStatus.ts` subscribes to window `online`/`offline` and seeds from `navigator.onLine`. `src/components/layout/OfflineBadge.tsx` renders a small "Offline" pill in the TopBar when offline. `WiktionaryLookup` uses it to gate the Look-up button on either being online or having an in-memory cache hit, and translates `WiktionaryError('network')` into a clear offline message.
- **Wiktionary runtime cache**. `vite.config.ts` adds two Workbox `runtimeCaching` rules (StaleWhileRevalidate, max 100 entries / 30 days) — one for the REST `/api/rest_v1/page/definition/*` endpoint, one for the action API `/w/api.php`. Previously-looked-up terms therefore resolve from cache when the network is unavailable.
- **Navigation fallback**. `workbox.navigateFallback: '<base>/index.html'` keeps offline deep-refreshes inside the SPA shell rather than hitting Workbox's default 404.
- **Build identity**. `vite.config.ts` injects `__APP_VERSION__` (from `package.json`), `__BUILD_SHA__` (from `git rev-parse --short HEAD`, falling back to `'dev'`), and `__BUILD_TIME__` via `define`. The Settings page shows all three in an "About" section so users can report bugs against a specific build.

## Phase 6 — AI integrations & semantic TM

Phase 6 introduces three machine translation providers and an opt-in semantic TM. Everything still runs in the browser; nothing leaves the device except the user's own MT calls.

- **Provider abstraction (`src/core/mt/`)** mirrors `src/core/glossary/wiktionary.ts` — pure functions, an injectable `fetchImpl`, a typed `MTError` with a discriminated `code`. Three providers ship: `ollama.ts` (POST `/api/chat` to a local endpoint, default `http://localhost:11434`, no key — error messages mention the `OLLAMA_ORIGINS` requirement explicitly); `claude.ts` (POST `https://api.anthropic.com/v1/messages` with `anthropic-version: 2023-06-01` and `anthropic-dangerous-direct-browser-access: true`, default model `claude-haiku-4-5-20251001`, maps 401/403→`auth`, 429→`rate_limit`); `libretranslate.ts` (configurable endpoint, optional API key, maps 400→`unsupported_lang`). DeepL from the original Phase 6 wording was dropped because `api.deepl.com` has no public CORS — substituted with LibreTranslate, which is also free/open and works directly from the browser.
- **Settings persistence (Dexie v2)**. `src/storage/db.ts` adds a `settings` key/value table (`&key`) and an `embeddings` table (`id, tmId, model, [tmId+model]`) via `this.version(2).stores(...)`. v1 tables are unchanged so the upgrade is purely additive. `src/storage/repositories/settingsRepo.ts` exposes typed `get<T>/set<T>` plus `MT_SETTINGS_KEY`, `SEMANTIC_TM_KEY`, defaults, and merge helpers (`mergeMTSettings`, `mergeSemanticTMSettings`). API keys are stored plaintext in IndexedDB — the Settings UI shows an explicit warning. Browser-side encryption would be theatre since the key has to be plaintext at use time.
- **MT panel (`src/features/editor/mt/`)** is a new third sidebar tab alongside TM and Glossary. `MTPanel.tsx` mirrors `TMPanel.tsx`: provider dropdown (only enabled providers), explicit "Translate" button (no auto-fetch — prevents accidental Claude spend), abort-on-source-change via `AbortController`, error keyed off `MTError.code`, "Apply" calls the same `handleApplyTM` callback the EditorPage already uses for TM. Offline gating mirrors `WiktionaryLookup`: Claude and LibreTranslate disable when `useNetworkStatus()` reports offline; Ollama (local) is always available. `useEditorActionsStore` gains `translateCurrentWithMT(providerId?)` so the command palette can trigger an MT translation on the current segment without prop drilling.
- **Semantic TM (opt-in)**. `src/core/embeddings/index.ts` lazily dynamic-imports `@xenova/transformers` and caches a `feature-extraction` pipeline keyed by model. The default model is `Xenova/paraphrase-multilingual-MiniLM-L12-v2` — 384-dim, ~50 MB quantized, multilingual. `src/workers/embeddings.worker.ts` exposes `embed`, `embedMany`, and `embedAndRank` via Comlink so the model runs off the main thread; `src/workers/client.ts` lazily wraps it (`getEmbeddingsWorker()`). `src/core/tm/semantic.ts` adds `findSemanticMatches` (looks up cached vectors in `embeddingsRepo`, sends only candidate vectors + the query to the worker for ranking) and `mergeMatches` (dedupes lexical + semantic results by entry id, lexical wins on tie). `useTMMatches` opts into semantic results when the user has enabled it; the TM panel's `MatchCard` adds a small `semantic` badge when `similarityMethod === 'semantic'`. An index is built from Settings → "Build / rebuild index", which chunks the entire TM through `worker.embedMany` (16 entries at a time) and writes `EmbeddingRecord { id, tmId, model, dim, vector: Float32Array, createdAt }` rows. Float32Array is stored natively via Dexie's structured clone.
- **Worker code-splitting**. `vite.config.ts` sets `worker.format: 'es'` because IIFE workers can't dynamically import `@xenova/transformers`. `optimizeDeps.exclude: ['@xenova/transformers']` keeps the library out of the prebundle. The final build splits `transformers-*.js` (~830 KB) into a separate chunk that only loads when the user enables semantic TM.
- **Model caching**. A new Workbox `runtimeCaching` rule (`CacheFirst`, `^https://huggingface.co/.*/resolve/.*`, 1-year max, `rangeRequests: true`) caches the embedding-model files so subsequent cold starts work offline after the one-time download.
- **Out of scope**: streaming MT (Ollama supports it; v1 is single-shot for simplicity), batch "translate all empty segments" (possible follow-up), encrypted key storage (not meaningful client-side), auto-translating on segment focus.

## Phase 14 — LAN collaboration (Foundation F3)

F3 turns the single-user CRDT layer (F2) into peer collaboration. F2 mirrored
each project's segments into a per-project Yjs doc one way (Dexie→Yjs,
`src/storage/sync/bridge.ts`). F3 closes the loop and adds a peer transport.
Decided architecture: **Tauri desktop peers + mDNS auto-discovery + encrypted
Yjs sync**, with the desktop shell staying thin (discovery + transport only) and
all product logic remaining in the shared React app.

This phase ships the **platform-agnostic TypeScript sync core** (fully tested in
the PWA) plus a **documented Tauri/Rust scaffold**; the cross-machine mDNS/LAN
networking under Tauri is the follow-up.

- **Reverse observer (Yjs→Dexie)** — `src/storage/sync/reverseBridge.ts` makes
  sync bidirectional. Remote updates are applied to the doc tagged
  `ORIGIN_REMOTE`; an `observeDeep` on the segments map reconciles the changed
  rows back into Dexie (the source of truth) via `readSegment` → `db.segments.put`,
  so `useLiveQuery`, TM, QA and version history see merged peer edits with no new
  read paths. Loop safety: our own mirror writes (`ORIGIN_DEXIE`) are ignored
  here, and the reverse Dexie write runs inside `withMirrorSuppressed` (a
  ref-counted guard in `bridge.ts`) so it never bounces back into the doc — which
  also stops an `updatedAt`-only ping-pong between peers (the reverse write keeps
  the doc's own LWW `updatedAt`).
- **Transport seam** — `src/storage/sync/transport/` defines `SyncTransport`
  (`start/send/onMessage/destroy`) and a `SyncMessage` union (`hello`, `bye`,
  `state-request`, `state`, `update`, `presence`). `BroadcastChannelTransport`
  is a zero-dependency same-machine, cross-tab implementation that works in the
  PWA today; `TauriLanTransport` is the desktop bridge (lazily imports
  `@tauri-apps/api` through a computed specifier so the PWA build neither bundles
  nor requires it). `createTransport()` picks one via `isTauri()` (`platform.ts`).
- **Sync session** — `src/storage/sync/syncSession.ts` binds a Yjs doc to a
  transport: local doc updates (origin ≠ `ORIGIN_REMOTE`) are broadcast; inbound
  `update`/`state` are applied with `ORIGIN_REMOTE` (driving the reverse bridge);
  a joining peer is answered with `Y.encodeStateAsUpdate` for initial
  convergence. `syncManager.ts` ref-counts one session per shared project and
  resolves identity (`profile.identity`), transport and encryption codec.
- **Presence** — `src/storage/sync/presence.ts` is a lightweight, dependency-free
  roster (peer id → name / colour / active segment) broadcast on a heartbeat with
  TTL expiry — ephemeral UI data, deliberately not a CRDT.
- **Encryption** — `src/storage/sync/crypto.ts` is a WebCrypto AES-GCM payload
  codec with a PBKDF2-derived key from a project share passphrase (deterministic
  salt from the project id so peers converge without a handshake). Identity codec
  for same-machine BroadcastChannel; real encryption for the LAN transport.
- **Opt-in sharing + UI** — sharing is per-project and off by default
  (`shareRepo`, stored in the `settings` table; no Dexie migration). `EditorPage`
  mounts `useProjectSync` (`src/features/editor/peers/`), which starts/stops the
  session on the share flag and publishes peers into `usePresenceStore`. A new
  **Peers** sidebar tab (`PeersPanel.tsx`) carries the share toggle and the live
  peer list; presence follows the focused segment.
- **Desktop scaffold** — `src-tauri/` (Cargo manifest, `tauri.conf.json`, `mdns.rs`
  advertising/browsing `_verbalis._tcp.local`, `transport.rs`, `commands.rs`
  exposing `start_sharing`/`stop_sharing`/`broadcast_sync_message`). Built by a
  separate Rust pipeline, intentionally **outside** the PWA CI — see
  `src-tauri/README.md`.

## Bundled terminology corpora (PT→EN)

A catalogue of pre-curated Brazilian-Portuguese→British-English terminology that ships with the app and is installed by field/area into the user's working set. Source data is the consolidated CADE / Noronha / TIPS termbase (~35k pairs) from the `pt-en-legal-translation` skill.

- **Build-time data prep (`scripts/build-corpora.mjs`)** reads `scripts/data/master_glossary.csv` (`pt,en,domain,source,note`), classifies each pair into a curated field via priority-ordered keyword rules (competition, tax, IP, labour, corporate, accounting-finance, criminal, civil-procedure, academic, contracts, with `general-legal` as the catch-all), de-duplicates on the pt+en pair, and writes one compact JSON pack per field plus `manifest.json` into `public/corpora/`. Re-run with `pnpm build-corpora` after editing the CSV or the `FIELDS` rules. Packs are disjoint (single primary field assignment) so install counts stay clean. The classification is keyword-heuristic by design — the bulk of the general legal termbase falls through to `general-legal`.
- **Static assets, not precache.** Pack JSON (one is ~1.7 MB) is fetched on demand, never bundled into JS and excluded from the SW precache (`workbox.globPatterns` only globs js/css/html/ico/png/svg/woff2). A `runtimeCaching` rule (`StaleWhileRevalidate`, `/(corpora|guide)/.*\.(json|md)$`) keeps installed packs and the guide available offline after first use.
- **Core (`src/core/corpus/`)**: `manifest.ts` fetches the catalogue/packs (resolving URLs against `import.meta.env.BASE_URL`); `match.ts` is an efficient whole-word matcher that scales to tens of thousands of terms — it builds a first-token index once (`buildCorpusIndex`) and, per segment, only tests candidate terms whose first word actually appears (`findCorpusHits`), preferring the longest match per position. `keySideForSourceLang` picks which side of the PT→EN corpus to match against based on the project's source language (PT source → PT side; EN source → EN side, suggesting PT). This avoids the per-entry regex cost of the hand-curated glossary matcher, which is fine for small user glossaries but would not survive 35k rows.
- **Storage (`corpusRepo`)** keeps corpus terms in their own `corpusTerms` table (separate from the user's editable `glossary`, for performance) and tracks install state in `corpusPacks`. `install()` persists terms, records the pack, and optionally seeds the TM (`db.tm.bulkAdd`, tagged with `corpusId`); `uninstall()` removes the terms, the record, and any TM entries it seeded. Re-install is idempotent (uninstall-then-install).
- **UI**: `/corpora` (`src/features/corpora/`) is the catalogue — one card per field with term count, provenance, an "Also add to TM" toggle, and install/remove. The editor Glossary panel surfaces corpus hits under a "From corpora" divider alongside hand-curated glossary hits (`useCorpusMatches` is only mounted when the Glossary tab is active, so there is no cost otherwise). The Glossary page shows an install summary banner linking to `/corpora`.
- **Translation guide (`/guide`, `src/features/guide/`)** renders the skill's workflow, standards/conventions and translation-theory reference docs (shipped as `public/guide/*.md`) via a small mdast→React renderer (`Markdown.tsx`) built on the existing `unified`+`remark-gfm` stack — no new dependency, no `dangerouslySetInnerHTML`.
