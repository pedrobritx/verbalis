# Phase 3.1 — Supabase bootstrap + Google/magic-link auth + PKCE

You are implementing **Phase 3.1** of the Verbalis Translation IDE revamp.

**Goal**: Add the lazy Supabase client (env-flagged, dynamic import, flowType 'pkce'), the pre-router ?code= exchange bootstrap for HashRouter, sign-in UI (Google + magic link), profiles migration + RLS, and docs/cloud.md.

Before touching code:

1. Read `docs/revamp/STATUS.md` — confirm this phase is `pending` and its dependencies (0.1) are `done`. If not, follow STATUS rules instead (fix the in-review PR, or stop and report).
2. Read `docs/revamp/ROADMAP.md` §4 Phase 3.1 — that section is the **complete and only** scope definition (files to create/modify, key design points, tests, DoD). Also read the §3 architecture decisions it cites. Do not exceed that scope.

## Invariants (non-negotiable)

- Local-only mode keeps working fully, with no account and no behavior regressions.
- The `richStateToPlain` contract is preserved (`src/core/editor/richText.ts`).
- Dexie remains the local source of truth.
- Supabase is strictly additive: behind `VITE_SUPABASE_URL`, dynamic `import()` only, zero bundle cost when unset, and vitest never hits real Supabase (injectable client).
- All existing tests keep passing.

## Verify

`pnpm typecheck && pnpm test:unit && pnpm build`. No new e2e required unless ROADMAP §4 says otherwise.

## Deliver

- Branch `claude/revamp-phase-3-1` created from latest `main`.
- Draft PR titled `Revamp 3.1: Supabase bootstrap + Google/magic-link auth + PKCE`.
- Update `docs/revamp/STATUS.md` in the same PR: this phase -> `in-review (PR #n)`, and record the merge of the previous phase if STATUS is stale.
- Subscribe to PR activity, then stop.
- If scope overflows the session: ship the core slice green, append the remainder as Phase 3.1.1 to STATUS and ROADMAP §4, and say so in the PR body.
