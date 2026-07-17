# Phase 4.4 — Live collab UX: cursors, leases, attribution

You are implementing **Phase 4.4** of the Verbalis Translation IDE revamp.

**Goal**: Add remote cursors/selection overlays, per-segment edit leases with deterministic tie-break, and profile-based presence; guard reverseBridge against stale-LWW rich mismatches.

Before touching code:
1. Read `docs/revamp/STATUS.md` — confirm this phase is `pending` and its dependencies (4.3, 1.6) are `done`. If not, follow STATUS rules instead (fix the in-review PR, or stop and report).
2. Read `docs/revamp/ROADMAP.md` §4 Phase 4.4 — that section is the **complete and only** scope definition (files to create/modify, key design points, tests, DoD). Also read the §3 architecture decisions it cites. Do not exceed that scope.

## Invariants (non-negotiable)
- Local-only mode keeps working fully, with no account and no behavior regressions.
- The `richStateToPlain` contract is preserved (`src/core/editor/richText.ts`).
- Dexie remains the local source of truth.
- Supabase is strictly additive: behind `VITE_SUPABASE_URL`, dynamic `import()` only, zero bundle cost when unset, and vitest never hits real Supabase (injectable client).
- All existing tests keep passing.

## Verify
`pnpm typecheck && pnpm test:unit && pnpm build`, plus Playwright: tests/e2e/lan-collaboration.spec.ts (extend, two-tab BroadcastChannel).

## Deliver
- Branch `claude/revamp-phase-4-4` created from latest `main`.
- Draft PR titled `Revamp 4.4: Live collab UX: cursors, leases, attribution`.
- Update `docs/revamp/STATUS.md` in the same PR: this phase -> `in-review (PR #n)`, and record the merge of the previous phase if STATUS is stale.
- Subscribe to PR activity, then stop.
- If scope overflows the session: ship the core slice green, append the remainder as Phase 4.4.1 to STATUS and ROADMAP §4, and say so in the PR body.
