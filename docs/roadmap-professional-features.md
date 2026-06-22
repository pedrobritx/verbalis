# VERBALIS — Roadmap to a Professional CAT Tool

> A phased plan for adding memoQ‑class capability to Verbalis **without losing the
> two things that make it different: it is local‑first and it is intuitive.**
> Inspired by memoQ; deliberately not a clone of it.

Status: planning document. The first slice of low‑risk UX wins ships alongside
this doc (see [§10](#10-what-ships-in-this-pr)). Everything else is sequenced
below.

---

## 1. How to read this

memoQ is powerful and dense — a ribbon with ~120 commands, modal resource
consoles, and a learning curve measured in weeks. Verbalis copies memoQ's
*capabilities*, not its *surface*. Every feature below is restated as "what
memoQ does" → "the Verbalis‑native, simpler treatment" → "where it plugs into
the current code".

The plan is built on three decisions already made with the maintainer:

| Decision | Choice |
|---|---|
| LAN collaboration | **Tauri desktop peers** with mDNS auto‑discovery + CRDT sync — every install is a real peer, no cloud, no central server |
| Rich editor core | **Lexical** (Meta) replaces the plain `<textarea>` segments |
| Document standards (ABNT/ISO/BSI/ANSI) | **Export/preview profiles**, built after the editor and collaboration land |

---

## 2. Guiding principles — the Verbalis difference

1. **Local‑first is the architecture, not a setting.** Nothing leaves the
   device unless the user initiates it. Collaboration is peer‑to‑peer on the
   LAN; spell‑checking, dictionaries and standards run on‑device.
2. **Progressive disclosure over a ribbon.** Power lives behind the command
   palette (`Ctrl/⌘+K`), contextual panels and keyboard flow — not 8 ribbon
   tabs. A first‑time translator should be productive in minutes.
3. **One obvious way to do the common thing.** memoQ offers five ways to
   confirm a segment; Verbalis offers one keystroke and one button, both
   discoverable.
4. **Round‑trip fidelity is sacred.** Formatting, inline tags and tracked
   changes must survive XLIFF/TMX/TBX import → edit → export.
5. **Offline‑complete.** Every feature must degrade gracefully or work fully
   offline, consistent with the PWA promise.

---

## 3. The three enabling foundations

Most requested features are blocked on one of three platform changes. Build
these first; the feature list then becomes mostly UI work.

### F1 — Rich segment editor (Lexical)

**Status: foundation + formatting shipped (Phase 10, opt-in).** The Lexical core,
formatting marks, case transforms, plain↔rich serialization and the
editor-handle abstraction are in. Inline tags and tracked changes are the next
two slices built on this core (see below).

**Why:** bold/italic/underline/sub‑sup/case, inline tags (quotes, footnotes,
bibliography), tracked changes and comment anchors all need rich text. Today a
segment's `source`/`target` are plain strings edited in a `<textarea>`
(`src/features/editor/SegmentRow.tsx`).

**Approach (what shipped):**
- `RichSegmentEditor` (`src/features/editor/rich/`) wraps a Lexical instance per
  target cell, lazy-loaded so Lexical (≈72 KB gzip) stays out of the main bundle
  until rich mode is on. Both editors implement a thin `SegmentEditorHandle`
  (`focus` / `insertText`) so `EditorPage` drives focus and glossary insertion
  without knowing which editor a cell uses.
- Formatting uses Lexical's **built-in** text formats (bold/italic/underline/
  subscript/superscript) — no custom mark node needed — surfaced via a focus-time
  `FormatToolbar` and keyboard shortcuts. Case transforms (UPPER/lower/Title/
  Sentence) are pure functions in `src/core/text/case.ts` applied to the
  selection.
- **Serialization is the contract.** Target is stored as Lexical JSON
  (`Segment.targetRich`) *plus* the derived plain‑text `target`, which stays the
  source of truth for TM matching, QA, search and counters. `richStateToPlain`
  (`src/core/editor/richText.ts`) derives plain text headlessly and is
  unit-tested, so storage always agrees with what TM/QA see.
- The plain `<textarea>` remains the default and the fallback for code segments;
  rich mode is a `richEditing` editor preference. TM/MT apply clears `targetRich`
  so the rich editor rebuilds cleanly from the applied plain text.

**Next slices on this core:**
- `InlineTagNode` (decorator chip) carrying the XLIFF tag payload, mapped ↔ the
  numeric placeholders round-tripped via `bilingualMeta.inlineTags`
  (`src/core/bilingual/xliff12.ts`) — for quotes / footnotes / bibliography.
  **Shipped (Phase 10).** Chips render in the rich editor and read-only in the
  source cell; F9 / a focus-time tag strip insert the next missing tag; the node's
  `getTextContent()` returns `{id}` so plain `target`, TM, QA and XLIFF export are
  unchanged. Pure helpers in `src/core/bilingual/inlineTags.ts`; node in
  `src/features/editor/rich/InlineTagNode.tsx`; chip (Lexical-free, reused by the
  source cell) in `InlineTagChip.tsx`; headless parser made tag-aware via a node
  registry in `src/core/editor/richText.ts`.
- `CommentMark` / `TrackedChangeMark` decorations once F2 (CRDT history) lands.
- Flip rich mode on by default once inline tags + broader (IME/paste/e2e)
  testing are in. **Deferred:** the flip needs the Playwright suite migrated off
  the textarea `.fill()` path first; it is a reversible one-line default change.
- XLIFF `<bpt>/<ept>` run styling on export (formatting marks → tags) is a
  follow-up; formatting currently round-trips only inside `targetRich`.

**Risk:** IME/undo/paste correctness, and keeping `target` (plain) and
`targetRich` in sync. Mitigate with a single source‑of‑truth (Lexical state) and
a pure `richToPlain()` serializer covered by unit tests.

**Effort:** L (the largest single item).

### F2 — Sync‑ready data layer + version history (CRDT)

**Status:** Shipped (single‑user). The Yjs data layer and version history are in;
only the F3 network transport remains.

**Why:** "versioning history" and "all computers syncing automatically" are the
same problem viewed at two scales. Solve once with a conflict‑free replicated
data type (CRDT), and single‑user undo‑history and multi‑peer merge both fall
out.

**Approach (what shipped):**
- Each project's segment set is mirrored into a **Yjs document**
  (`src/storage/sync/segmentCrdt.ts`): `target` is a `Y.Text`, comments a
  `Y.Array<Y.Map>`, everything else plain LWW values. The doc persists in
  IndexedDB via **`y-indexeddb`** (`docManager.ts`), separate from Dexie.
- **Dexie stays the source of truth**; the doc is a derived mirror fed by Dexie
  hooks (`bridge.ts`), so all existing segment write paths and `useLiveQuery`
  reads are untouched. Data flows one way (Dexie→Yjs) tagged `ORIGIN_DEXIE`, so
  F3's reverse observer is purely additive and loop‑free.
- **Version history** = `Y.encodeStateAsUpdateV2` snapshots in a `versions` Dexie
  table (`versionRepo.ts`): a "Save version" beat plus a throttled auto safety
  net. The editor's **History** sidebar tab restores whole‑project versions;
  each row's **Row history…** action shows a per‑segment timeline (word diffs,
  who/when) and restores a single segment. Restores route back through Dexie and
  snapshot first, so they are reversible.
- Built **before** collaboration so single‑user versioning ships first and the
  network layer (F3) is purely additive.

**Effort:** L. **Sequence:** versioning first (single‑user), sync second.

### F3 — LAN collaboration via desktop peers (Tauri + mDNS)

**Status: sync core shipped; desktop networking scaffolded.** The
platform-agnostic TypeScript half of F3 is in and tested in the PWA: the
bidirectional CRDT (reverse Yjs→Dexie observer), a `SyncTransport` seam with a
working same-machine BroadcastChannel transport, presence, an AES-GCM payload
codec, and opt-in per-project sharing with a **Peers** sidebar tab. The Tauri
shell + Rust mDNS sidecar (`src-tauri/`) are scaffolded behind an `isTauri()`
seam; building the desktop release pipeline and the real cross-machine mDNS/LAN
networking is the remaining slice. See `docs/architecture.md` → "Phase 14".

**Why:** "all computers work as servers, syncing automatically on the same
network." Browsers can't bind sockets or do mDNS; a Tauri desktop shell can,
while reusing 100% of the existing React app.

**Approach:**
- Wrap the existing SPA in **Tauri**. The PWA stays the zero‑install entry
  point; the desktop build adds peer capabilities.
- A small Rust sidecar does **mDNS/zeroconf discovery** (`_verbalis._tcp.local`)
  so peers find each other with no configuration — the "server URL" box from
  memoQ's resource console becomes "peers found on your network".
- Peers exchange Yjs updates over an authenticated, **end‑to‑end‑encrypted**
  channel (libp2p or a thin WebSocket‑over‑LAN transport). Every peer holds the
  full project, so any machine going offline is a non‑event.
- Project sharing is opt‑in per project; a project stays private until shared.

**Effort:** XL. **Sequence:** last of the three foundations.

```
F1 Lexical editor ─┐
                   ├─► unlocks: formatting, tags, tracked changes, comments anchoring,
F2 CRDT + history ─┤            edit-source-as-change, segment handling
                   └─► unlocks: version history → LAN sync (F3) → live collaboration
```

---

## 4. Phased roadmap

Continues the numbering in `docs/architecture.md` (phases 0–6 done, 7+ planned).

| Phase | Theme | Headline deliverables | Depends on |
|---|---|---|---|
| **8** | **Editor UX wins** ✅ | Auto‑collapsing sidebar, per‑segment confirm button, comments, edit source, guided tips, local identity | — |
| **9** | **Segment handling** ✅ | Lock / split / join, non‑breaking abbreviation list (insert/move deferred) | — |
| **10** | **Rich editing (F1)** | Lexical core, bold/italic/underline/sub‑sup, case transforms ✅; inline tag chips + F9 insertion + QA tag rule ✅ (opt-in); rich-on-by-default deferred | F1 |
| **11** | **Language quality** | Web search + AutoCorrect ✅; grammar/style QA hints + selection lookup ✅; on‑device Hunspell spell‑check (panel) ✅, rich‑editor squiggles next | — (F1 for inline marks) |
| **12** | **Versioning (F2)** | CRDT data layer, per‑segment history, named project snapshots, tracked changes + show/hide | F1, F2 |
| **13** | **Workflow & layout** | Source‑prep / translation / revision layouts, layout customization, view density | F1 |
| **14** | **Collaboration (F3)** 🚧 | Bidirectional CRDT sync, transport seam + BroadcastChannel peers, presence, encryption codec, opt-in sharing UI ✅; Tauri/mDNS desktop networking next | F2, F3 |
| **15** | **Resources sync** | Update/download glossaries, TMs, corpora; shared project resources over LAN | F3 |
| **16** | **Document standards** | ABNT/ISO/BSI/ANSI export/preview profiles: citations, references, numbering, indentation, index | F1 |

Phases are independently shippable; 9, 11 and 13 can interleave with the heavier
foundation work.

---

## 5. Per‑feature design notes

### A. Editing core & formatting

**Text styling — bold / italic / underline / sub‑sup / case** *(shipped, Phase 10, opt-in)*
- memoQ: ribbon Format group + `Ctrl+B/I/U`, `Ctrl+Shift+=` etc.
- Verbalis: a focus-time `FormatToolbar` + `Ctrl+B/I/U`, using Lexical's built-in
  text formats (bold/italic/underline/subscript/superscript). Case
  (UPPER/lower/Title/Sentence) is a toolbar menu backed by pure transforms in
  `src/core/text/case.ts` — no storage change. Marks persist in `targetRich`.
- Round‑trip to XLIFF `<bpt>/<ept>` run styling on export is a follow-up (lands
  with inline tags).

**Inline tagging — quotes, footnotes, bibliography** *(shipped, Phase 10, opt-in)*
- memoQ: numbered inline tags `{1}…{2}` that must be carried to the target.
- Verbalis: `InlineTagNode` renders each placeholder as a compact chip (glyph by
  kind — "¹" footnote, "❝" quote, "※" biblio — plus the id) with hover detail,
  classified from the stored tag XML by `classifyInlineTag`
  (`src/core/bilingual/inlineTags.ts`). The source cell shows the same chips
  read‑only; a focus‑time **tag strip** lists the source tags and `F9` inserts the
  next one still missing from the target (`nextMissingTagId`). The QA *tag
  mismatch* rule (`src/core/qa/checks.ts`) already compares the placeholder
  multiset and is unaffected, because the chip's `getTextContent()` returns
  `{id}` — plain `target` stays the contract for TM/QA/search/export. Footnote/
  citation tags will reference entries managed by the standards engine (Phase 16).

**Edit source** *(shipped, Phase 8)*
- memoQ: "Edit source" toggles the source cell editable.
- Verbalis: per‑row "Source" pencil makes the original editable with debounced
  autosave (`SegmentRow.tsx`). In Phase 12 a source edit becomes a *tracked
  change* and, for bilingual projects, is flagged because it diverges from the
  imported skeleton.

**Segment handling — lock / split / join** *(shipped, Phase 9)*
- memoQ: `Ctrl+T` split, `Ctrl+J` join, lock, etc.
- Verbalis: a per‑row **⋯ actions menu** (`segments/SegmentActionsMenu.tsx`) plus
  keyboard parity (`Ctrl/⌘+J` join). **Lock** is an *orthogonal* `Segment.locked`
  flag — not the `locked` status value — so a locked reviewed segment keeps its
  reviewed state; locked rows become read‑only and are excluded from confirm,
  pre‑translate, number population and auto‑propagation (`EditorPage.tsx`).
  **Split** uses a caret‑position dialog (`segments/SplitSegmentDialog.tsx`);
  **split/join** re‑index siblings atomically via `bulkPut` inside a Dexie
  transaction (`segmentRepo.splitSegment` / `joinWithNext`), with pure decision
  logic in `core/segments/operations.ts` (`splitSourceText`, `canJoin`,
  `mergeStatus`). Join is restricted to the same source block; the merged status
  is the *less complete* of the two.
- **Bilingual guard:** split/join are disabled for XLIFF projects because export
  maps strictly by `transUnitId` against a stored template — a split/merged
  segment has no matching trans‑unit and would be dropped. Lock works for both.
- **Deferred within the phase:** insert‑empty and move/reorder. They share the
  re‑index machinery but add little value against the same XLIFF round‑trip risk;
  revisit once rich content (F1) and versioning (F2) land.

**Abbreviations handler** *(non‑breaking list shipped Phase 9; AutoCorrect Phase 11)*
- Two distinct needs: (1) a **non‑breaking abbreviation list** so the segmenter
  doesn't split "Art. 5º" — extends `src/core/segmentation/sbdOptions.ts` with the
  English defaults plus a curated PT/legal set (sbd *replaces* rather than extends
  its list, so both are shipped). ✅ Phase 9.
  (2) an **AutoCorrect/expansion** map ("eg" → "e.g.", custom shorthands) applied
  on input — shipped (Phase 11). Pure core `src/core/text/autocorrect.ts`
  (`autocorrectOnInput`, whole-word, capital-preserving), wired into the plain
  editor (`SegmentRow`) and gated by an editable, default-off rules list in
  `EditorSettingsSection`. Seeded with PT/EN defaults; rich-editor AutoCorrect is a
  follow-up once rich mode is default-on.

### B. Language quality

**Grammar/style hints** *(shipped, Phase 11)*
- memoQ: rule-based QA for spacing, punctuation and consistency.
- Verbalis: rule‑based hints run in the existing pure QA pass
  (`src/core/qa/checks.ts`) and surface in the QA panel + per‑rule Settings toggles
  with no new UI (both iterate `QA_CODES`). Shipped rules: **space before
  punctuation** (locale‑aware — French keeps its space before `; : ? !`),
  **repeated word** back‑to‑back, and **straight quotes** (default off), alongside
  the pre‑existing double‑space / whitespace / terminology‑consistency checks —
  privacy‑safe and fully offline.

**Spelling (Hunspell)** *(panel shipped, Phase 11; rich-editor squiggles next)*
- memoQ: Hunspell or MS Word; squiggly underlines; download dictionaries.
- Verbalis: **nspell** (pure-JS, Hunspell-compatible — same wooorm ecosystem as
  remark; chosen over a WASM build for far less complexity, same offline result)
  runs in a **Web Worker** (`src/workers/spell.worker.ts`, `getSpellWorker`).
  Dictionaries are bundled static assets (`public/dictionaries/<lang>/`, built by
  `scripts/build-dictionaries.mjs` from the `dictionary-*` packages), fetched on
  demand and `CacheFirst` SW-cached — never precached. The active dictionary
  follows `project.targetLang` (en + pt ship today). A **Spelling sidebar panel**
  lists the focused segment's misspellings with click-to-apply suggestions, plus
  "Add to dictionary" (a personal word list in `settings`/`spell.dicts`) and
  "Ignore" — working in **both** the plain textarea and the rich editor. Pure
  core in `src/core/spell/` (`tokenizeWords`, `createChecker`). No text leaves the
  device. **Next:** rich-editor squiggle decorations + inline suggestion popover.

**Dictionary lookup** *(shipped, Phase 11)*
- Already present: Wiktionary adapter + Quick Lookup dialog (`src/features/lookup`,
  `src/features/translate/TranslateWorkspace.tsx`, `src/core/glossary/wiktionary.ts`,
  offline‑cache‑first via the Workbox runtime cache). Now **selection‑aware**:
  `Ctrl/⌘+L` opens Quick Lookup prefilled with the selected/current term
  (`useGlobalShortcuts.ts` → `activeSelectionText()`), and a "Quick lookup…" command
  palette entry mirrors it. A dedicated inline popover remains a possible refinement.

**Web search** *(shipped, Phase 11)*
- memoQ: configurable web‑search providers in the resource console.
- Verbalis: a Settings list of providers (`{id, name, urlTemplate, enabled}` with
  `{q}`, `{src}` and `{tgt}` placeholders — `src/core/websearch/providers.ts`,
  `buildSearchUrl`), edited in `WebSearchSettingsSection`. Enabled providers appear
  in the command palette and open the focused segment's **source** term directly in
  the user's browser via `editorActions.webSearchCurrent` (no proxy → nothing about
  the query is logged by Verbalis). Ships with Linguee, Reverso, WordReference,
  DeepL‑web, Google and Google Scholar, all disabled until enabled.

### C. Review & collaboration

**Confirmation button** *(shipped, Phase 8)*
- Per‑row ✓ button mirroring `Ctrl/⌘+Enter`; in review mode it becomes the
  reviewed toggle (`SegmentRow.tsx`).

**Comments** *(shipped, Phase 8; threaded in Phase 12)*
- Inline per‑segment thread with author, relative time, resolve and delete
  (`src/features/editor/comments/`). Author comes from the new local identity.
  Phase 12 anchors comments to a text range via a `CommentMark` and adds a
  project‑wide comments view.

**Changes tracking + show/hide** *(Phase 12)*
- memoQ: per‑author insertion/deletion colors, mark insertions underlined /
  deletions struck through, toggle visibility (see the Appearance → Tracked
  changes screenshot).
- Verbalis: tracked changes are a natural read of the CRDT history — each edit
  carries its author (the local identity) and timestamp. Render as
  `TrackedChangeMark` decorations with per‑author colors; a single toolbar
  toggle shows/hides them; accept/reject per change or in bulk. No separate
  "track changes on/off" mode to forget — history is always recorded, *display*
  is the toggle.

**Versioning history** *(Phase 12)*
- Per‑segment timeline (who/when/what) and named project snapshots with
  diff‑and‑restore, both derived from F2. Auto‑snapshot on confirm + manual
  "Save version" with a label.

**Collaborative projects on the LAN** *(Phase 14)*
- Tauri peers + mDNS + encrypted Yjs sync (F3). Presence avatars show who's in a
  project and which segment they're on; edits merge conflict‑free. memoQ's
  server URL / "share on server" becomes "Share with peers on this network".

### D. Workflow & layout

**Auto‑collapse sidebar** *(shipped, Phase 8)*
- The nav sidebar auto‑collapses inside `/project/:id` for a wider grid, with a
  manual override that re‑arms on re‑entry (`src/components/layout/Sidebar.tsx`).

**Three workflow‑stage layouts** *(Phase 13)*
- **Source preparation:** source‑forward, segmentation/tag/abbreviation tools,
  target hidden or narrow.
- **Translation:** the current balanced grid + TM/Glossary/MT panels.
- **Revision:** tracked changes and comments visible, QA panel pinned, compare
  view of versions.
- Implemented as **layout presets** that set panel visibility, column ratios and
  which side tabs are open — a single switcher in the editor header, persisted
  per project. Builds on the existing `useSidebarPanelStore` / `useEditorModeStore`.

**Layout customization** *(Phase 13)*
- Resizable columns (drag the source/target divider), font size for source vs
  target (memoQ Appearance → font size), density (comfortable/compact), and
  reorderable side panels. Persisted in Settings.

**Help guiding tips** *(shipped basic, Phase 8; expanded Phase 13)*
- A dismissible, recallable tips strip in the editor (`EditorTips.tsx`). Expand
  to context‑aware coach‑marks on first use of each new surface, plus a "What's
  this?" affordance, all gated by `localStorage` so they never nag.

### E. Resources

**Update & download glossaries, memories, corpora** *(Phase 15)*
- Today corpora install from bundled packs (`/corpora`, `src/core/corpus`).
  Generalize to a **catalogue with versions**: each resource pack has a version;
  Settings shows "update available" and downloads deltas (Workbox‑cached, like
  today). Over the LAN (F3), a peer can offer its TM/glossary/corpus as a shared
  resource — the memoQ "Translation memories / Term bases / LiveDocs on server"
  model, but peer‑to‑peer.

### F. Document standards — ABNT / ISO / BSI / ANSI *(Phase 16)*

- memoQ leans on the source document's own formatting; Verbalis goes further with
  **standard‑aware export/preview profiles**.
- A profile is a declarative spec: heading/numbering scheme, indentation,
  citation style, reference list format, index generation, page/section rules.
- Pipeline: structured document (segments + `sourceMeta` block kinds + inline
  tags) → profile transform → preview / export (DOCX via a writer, PDF, or
  HTML). Citations/footnotes/bibliography tags from Phase 10 feed the
  reference engine.
- Sequence within the phase: **ABNT first** (matches the PT→EN focus and the
  bundled translation guide), then ISO, then BSI/ANSI. Start with
  citations + references, then numbering/indentation, then index/layout.

---

## 6. Data model evolution

All additive; Dexie migrations only ever increment (`src/storage/db.ts`).

| Version | Change | Notes |
|---|---|---|
| v4 | `Segment.comments?: SegmentComment[]` *(Phase 8)* | Inline, no index needed; no migration required |
| v4 | `Segment.locked?: boolean` *(Phase 9)* | Orthogonal lock flag; not indexed, no migration required |
| v4 | `Segment.targetRich?` (Lexical JSON) *(Phase 10)* | Plain `target` stays the derived source of truth; not indexed, no migration |
| v5 | `Segment.sourceRich?` (when source becomes rich) | Future, with inline tags |
| v5 | `versions` table `{id, projectId, label, kind, snapshot, segmentCount, author, createdAt}` *(Phase 12, shipped)* | Project snapshots; per‑segment history derived from the blobs |
| v5 | Yjs doc per project via `y-indexeddb` (outside Dexie) *(shipped)* | Dexie stays the query layer; doc is a derived mirror |
| v7 | `resources` versioning fields; `peers`/share metadata | Collaboration + resource sync |
| — | Settings keys: `profile.identity` *(this PR)*, `abbreviations`, `autocorrect`, `webSearch.providers`, `layout.presets`, `spell.dicts` | Key/value `settings` table |

---

## 7. Capacity & sequencing (effort sizing)

T‑shirt sizes; a "slice" ≈ a few focused days.

| Item | Size | Parallelizable? |
|---|---|---|
| Phase 8 UX wins | S | ✅ (shipped) |
| Segment handling | M | ✅ independent |
| Lexical core (F1) | L | ⛔ blocks 10/12/13 |
| Formatting + tags | M | after F1 |
| Spell/grammar/dict/web | M | mostly independent |
| CRDT + versioning (F2) | L | ⛔ blocks 12/14 |
| Tracked changes | M | after F1+F2 |
| Workflow layouts | M | after F1 |
| Tauri + mDNS sync (F3) | XL | ⛔ blocks 14/15 |
| Resource sync | M | after F3 |
| Standards profiles | L | after F1 |

**Critical path:** F1 → F2 → F3. Everything else clusters around these.
Recommended order: ship Phase 8 (done) → Phase 9 (quick, independent) →
Phase 10 (F1) → Phase 11 (independent, fills time) → Phase 12 (F2) →
Phase 13 → Phase 14/15 (F3) → Phase 16.

---

## 8. UX & design‑system guidelines

- **Reuse the token system.** All new surfaces use `src/styles/tokens.css`
  variables (`--color-accent`, `--color-confirm`, …) and the owned `ui/`
  primitives — never raw hex. New components match the existing quiet,
  high‑contrast aesthetic.
- **Discoverability without clutter.** Every new action is reachable from the
  command palette *and* has a visible affordance with a tooltip. No feature is
  keyboard‑only.
- **Don't reintroduce a ribbon.** Group by task (translate / review / prepare)
  via layout presets, not by a permanent multi‑tab toolbar.
- **Accessibility.** Rich editor must preserve keyboard navigation, ARIA roles
  on tags/comments/changes, and IME support. Keep the `data-testid` contract so
  the Playwright suite keeps passing.
- **Mobile.** The PWA stays usable on touch; new panels extend the existing
  `MobileSidebarSheet` pattern rather than assuming a desktop layout.

---

## 9. Risks & open questions

1. **Plain ↔ rich sync.** TM, QA, search and counters assume plain strings.
   Keep Lexical the source of truth and derive plain text deterministically;
   never let the two drift. *(Decided.)*
2. **XLIFF fidelity with rich content.** Validate round‑trip against real memoQ
   `.mqxliff` and Trados files in the e2e fixtures before shipping Phase 10.
3. **Desktop build maintenance.** Tauri adds a Rust toolchain and a second
   release pipeline. Keep all product logic in the shared React app; the desktop
   shell stays thin (discovery + transport only).
4. **CRDT history growth.** Snapshot/compaction strategy needed so the Yjs doc
   and version table don't grow unbounded on long projects.
5. **Spell/grammar scope.** Hunspell covers spelling well; full grammar is large.
   Ship rule‑based hints first; treat deep grammar as a later, optional,
   still‑on‑device addition.
6. **Open:** Should shared LAN projects support a "lighter" browser peer (WebRTC)
   for machines that can't install the desktop app, as a fallback to F3? Revisit
   after Phase 14.

---

## 10. What ships in this PR

The low‑risk, high‑value Phase 8 slice — no foundation work, fully tested:

- **Auto‑collapsing sidebar** while inside a project, with a manual override that
  re‑arms on re‑entry — `src/components/layout/Sidebar.tsx`.
- **Per‑segment confirm button** (✓) mirroring `Ctrl/⌘+Enter`; doubles as the
  reviewed toggle in review mode — `src/features/editor/SegmentRow.tsx`.
- **Comments** — inline per‑segment threads with author, relative time, resolve
  and delete — `src/features/editor/comments/SegmentComments.tsx`, repo ops in
  `src/storage/repositories/segmentRepo.ts`, type in `src/core/types`.
- **Edit source** — per‑row toggle to fix a mis‑segmented original with debounced
  autosave — `src/features/editor/SegmentRow.tsx`.
- **Guided help tips** — dismissible, recallable tips strip in the editor —
  `src/features/editor/EditorTips.tsx`.
- **Local identity** — a "Display name" used for comment authorship and, later,
  collaboration peers — `src/features/settings/ProfileSettingsSection.tsx`,
  `profile.identity` setting.

Tests: new `segmentRepo` comment‑operation cases; full suite green
(`tsc -b`, `vitest`, `vite build`).
