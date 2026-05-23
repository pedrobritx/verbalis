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
| 5 | PWA hardening, offline edge cases, update notification |
| 6+ | AI integrations (Ollama, Claude, DeepL), semantic TM |
