# Phase 0.1 — CI hardening

You are implementing **Phase 0.1** of the Verbalis Translation IDE revamp.

**Goal**: Add a CI workflow that runs typecheck, vitest, build, and Playwright (chromium) on every PR, as the guardrail all later autonomous phases depend on.

Before touching code:
1. Read `docs/revamp/STATUS.md` — confirm this phase is `pending` and its dependencies (none) are `done`. If not, follow STATUS rules instead (fix the in-review PR, or stop and report).
2. Read `docs/revamp/ROADMAP.md` §4 Phase 0.1 — that section is the **complete and only** scope definition (files to create/modify, key design points, tests, DoD). Also read the §3 architecture decisions it cites. Do not exceed that scope.

## Invariants (non-negotiable)
- Local-only mode keeps working fully, with no account and no behavior regressions.
- The `richStateToPlain` contract is preserved (`src/core/editor/richText.ts`).
- Dexie remains the local source of truth.
- All existing tests keep passing.

## Verify
`pnpm typecheck && pnpm test:unit && pnpm build`, plus Playwright: the full existing e2e suite.

## Deliver
- Branch `claude/revamp-phase-0-1` created from latest `main`.
- Draft PR titled `Revamp 0.1: CI hardening`.
- Update `docs/revamp/STATUS.md` in the same PR: this phase -> `in-review (PR #n)`, and record the merge of the previous phase if STATUS is stale.
- Subscribe to PR activity, then stop.
- If scope overflows the session: ship the core slice green, append the remainder as Phase 0.1.1 to STATUS and ROADMAP §4, and say so in the PR body.
