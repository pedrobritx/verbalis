# VERBALIS — Architecture

## Overview

VERBALIS is a local-first, browser-native CAT (Computer-Assisted Translation) tool. It runs entirely as a static site with no server, no backend, and no account requirement. User data stays in IndexedDB on the device.

## Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | React 18 + TypeScript | Strict mode, full type safety |
| Bundler | Vite 6 | base: '/verbalis/' for GH Pages |
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

## Storage Schema (v1)

| Table | Indexes |
|---|---|
| projects | id, name, updatedAt |
| segments | id, projectId, index, status |
| tm | id, source, sourceLang, targetLang, projectId |
| glossary | id, term, projectId |

Migrations are handled by Dexie's versioning system (`this.version(N).stores(...)`). Always increment, never modify existing version blocks.

## Deployment

Static build → GitHub Actions → GitHub Pages at `https://pedrobritx.github.io/verbalis/`.

Critical GH Pages constraints:
- `base: '/verbalis/'` in vite.config.ts
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
| 6+ | AI integrations (Ollama, Claude, DeepL), semantic TM |

## Phase 5 — PWA Layer

Verbalis is installable and works fully offline once the service worker has cached the shell. Phase 5 turns three latent stubs into real behaviour and hardens the one network-dependent feature (Wiktionary).

- **Update notification (prompt mode)**. `vite-plugin-pwa` is configured with `registerType: 'prompt'` so a new build is not auto-applied — `src/pwa/register.ts` wires `onNeedRefresh` into a Zustand store (`src/pwa/usePwaStore.ts`) and `src/pwa/UpdateBanner.tsx` renders a fixed banner with "Reload" and "Later". Reload calls the `updateSW(true)` function returned by `registerSW`, which triggers `skipWaiting` + page reload. This keeps in-flight textarea edits safe.
- **First-run offline-ready toast**. `onOfflineReady` flips the same store; `src/pwa/OfflineReadyToast.tsx` shows a one-shot "ready to work offline" toast gated by `localStorage` (`verbalis.pwa.offlineReadyAck`). The ack key is cleared whenever `onNeedRefresh` fires so a post-update install re-confirms.
- **Online/offline awareness**. `src/hooks/useNetworkStatus.ts` subscribes to window `online`/`offline` and seeds from `navigator.onLine`. `src/components/layout/OfflineBadge.tsx` renders a small "Offline" pill in the TopBar when offline. `WiktionaryLookup` uses it to gate the Look-up button on either being online or having an in-memory cache hit, and translates `WiktionaryError('network')` into a clear offline message.
- **Wiktionary runtime cache**. `vite.config.ts` adds two Workbox `runtimeCaching` rules (StaleWhileRevalidate, max 100 entries / 30 days) — one for the REST `/api/rest_v1/page/definition/*` endpoint, one for the action API `/w/api.php`. Previously-looked-up terms therefore resolve from cache when the network is unavailable.
- **Navigation fallback**. `workbox.navigateFallback: '/verbalis/index.html'` keeps offline deep-refreshes inside the SPA shell rather than hitting Workbox's default 404.
- **Build identity**. `vite.config.ts` injects `__APP_VERSION__` (from `package.json`), `__BUILD_SHA__` (from `git rev-parse --short HEAD`, falling back to `'dev'`), and `__BUILD_TIME__` via `define`. The Settings page shows all three in an "About" section so users can report bugs against a specific build.
