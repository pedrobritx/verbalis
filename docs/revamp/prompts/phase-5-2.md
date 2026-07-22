# Phase 5.2 — Role-gated editing workflow

You are implementing **Phase 5.2** of the Verbalis Translation IDE revamp.

**Goal**: Add pure workflow rules (role x stage -> capabilities), project stage/deadline (PM-only), forced suggesting for translators in review stage, and role-gated accept/reject; local-only projects stay fully permissive.

Before touching code:

1. Read `docs/revamp/STATUS.md` — confirm this phase is `pending` and its dependencies (5.1, 1.6) are `done`. If not, follow STATUS rules instead (fix the in-review PR, or stop and report).
2. Read `docs/revamp/ROADMAP.md` §4 Phase 5.2 — that section is the **complete and only** scope definition (files to create/modify, key design points, tests, DoD). Also read the §3 architecture decisions it cites. Do not exceed that scope.

## Invariants (non-negotiable)

- Local-only mode keeps working fully, with no account and no behavior regressions.
- The `richStateToPlain` contract is preserved (`src/core/editor/richText.ts`).
- Dexie remains the local source of truth.
- Supabase is strictly additive: behind `VITE_SUPABASE_URL`, dynamic `import()` only, zero bundle cost when unset, and vitest never hits real Supabase (injectable client).
- All existing tests keep passing.

## Verify

`pnpm typecheck && pnpm test:unit && pnpm build`. No new e2e required unless ROADMAP §4 says otherwise.

## Deliver

- Branch `claude/revamp-phase-5-2` created from latest `main`.
- Draft PR titled `Revamp 5.2: Role-gated editing workflow`.
- Update `docs/revamp/STATUS.md` in the same PR: this phase -> `in-review (PR #n)`, and record the merge of the previous phase if STATUS is stale.
- Subscribe to PR activity, then stop.
- If scope overflows the session: ship the core slice green, append the remainder as Phase 5.2.1 to STATUS and ROADMAP §4, and say so in the PR body.
