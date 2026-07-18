# Revamp status

Single source of truth for build progress. **Every revamp PR must update this file.**
States: `pending` · `in-progress` · `in-review (PR #n)` · `done (PR #n)` · `skipped (reason)`.

Rules for autonomous sessions:
1. Work on exactly one phase per session, chosen as: the first `pending` phase (top-to-bottom) whose **Depends on** entries are all `done`.
2. If a phase is `in-review`, check its PR for CI failures or review comments and fix them instead of starting a new phase.
3. Never mark a phase `done` yourself — only the owner merging the PR does that (the next session records the merge here).
4. Scope overflow: ship the core slice green, then append the remainder as a new row (e.g. `1.3.1`) here and in ROADMAP §4.

| Phase | Name | Size | Depends on | Status |
| --- | --- | --- | --- | --- |
| 0 | Bootstrap: roadmap, status, prompts, vision docs in repo | S | — | in-review |
| 0.1 | CI hardening (typecheck + vitest + Playwright on PRs) | S | — | in-review (PR #37) |
| 1.1 | Change model core + ChangeMarkNode + derivation semantics | M | 0.1 | pending |
| 1.2 | Rich editing default-on + Playwright migration | M | 1.1 | pending |
| 1.3 | Suggesting mode (edits become tracked suggestions) | M | 1.2 | pending |
| 1.4 | Accept/reject + Changes panel rework | M | 1.3 | pending |
| 1.5 | Range-anchored threaded comments | M | 1.2 | pending |
| 1.6 | Review polish: confirm gating, navigation, attribution | S | 1.4, 1.5 | pending |
| 2.1 | Document/block schema (Dexie v6) + backfill | M | 0.1 | pending |
| 2.2 | DOCX import fidelity upgrade | M | 2.1 | pending |
| 2.3 | Document preview pane | M | 2.1 | pending |
| 2.4 | Clean DOCX export | M | 2.2, 2.3 | pending |
| 3.1 | Supabase bootstrap + Google/magic-link auth + PKCE | M | 0.1 | pending |
| 3.2 | Microsoft + Apple providers + account settings | S | 3.1 | pending |
| 3.3 | Synced preferences/settings/layout | M | 3.1 | pending |
| 3.4 | Personal term bank + TM sync | M | 3.3 | pending |
| 4.1 | Cloud project schema + RLS + publish/join | M | 3.1 | pending |
| 4.2 | SupabaseRealtimeTransport + chunking | M | 4.1 | pending |
| 4.3 | Postgres persistence loop (catch-up, append, compaction) | M | 4.2 | pending |
| 4.4 | Live collab UX: cursors, leases, attribution | M | 4.3, 1.6 | pending |
| 5.1 | Members & roles management | M | 4.1 | pending |
| 5.2 | Role-gated editing workflow | M | 5.1, 1.6 | pending |
| 5.3 | Approval workflow + attribution in versioning | S | 5.2 | pending |
| 6.1 | Extension registry + MT providers as built-in addons | M | 0.1 | pending |
| 6.2 | QA rules + formats as addons + Add-ons page | M | 6.1 | pending |
| 6.3 | Google Drive connector | M | 6.1, 2.4 | pending |
| 6.4 | OneDrive connector | S | 6.3 | pending |

## Log

- 2026-07-17 — Phase 0: plan drafted from the five vision documents + codebase exploration; committed to `claude/verbalis-ide-revamp-plan-bvvrzz`.
- 2026-07-18 — Phase 0.1: CI workflow stacked on PR #37 (same branch as Phase 0, owner-approved) so the new CI validates the bootstrap PR itself. Deviation from ROADMAP wording: triggers on `pull_request` only (not non-main pushes) to avoid double-running CI on every PR push; every phase ships as a PR, so coverage is identical.
- 2026-07-18 — Phase 0.1 also repaired 5 e2e specs that had silently rotted on `main` (nothing ran them in CI — exactly why this phase exists): the sidebar's tab strip became stacked sections (`sidebar-tab-*` testids gone), Settings gained sectioned navigation (`settings-nav-*` click required), glossary insert buttons were renamed (`glossary-insert-primary/secondary`), and a duplicate `peers-panel` testid in `SidebarPanel.tsx` broke strict mode (app fix: wrapper testid removed). Full suite green: 498 unit / 15 e2e.
