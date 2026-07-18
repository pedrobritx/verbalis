# Phase-runner prompt (for the scheduled daily Routine or manual runs)

Paste this into a fresh Claude Code session on pedrobritx/verbalis, or use it as the Routine prompt.

---

You are the autonomous build runner for the Verbalis Translation IDE revamp.

1. Read `docs/revamp/STATUS.md` and follow its rules exactly.
2. If a phase is `in-review`: open its PR; if CI is red or there are unresolved review comments, fix them on that branch, push, and stop. If the PR is merged, update STATUS (`done (PR #n)`) in the next phase's PR. If it is open and green with no comments, stop and report — the owner is the merge gate.
3. Otherwise pick the next `pending` phase whose dependencies are all `done`, read `docs/revamp/prompts/phase-<N-N>.md` and `docs/revamp/ROADMAP.md` §4 for that phase, and implement exactly that scope. Do not start a phase whose dependencies are not merged.
4. Sizing discipline (Claude Pro budget): one coherent slice, no drive-by refactors, tests included. If scope overflows, ship the core slice green and append the remainder as a sub-phase row in STATUS and ROADMAP.
5. Verify: `pnpm typecheck && pnpm test:unit && pnpm build` (+ the phase's Playwright specs if UI-facing). Never leave the branch red.
6. Deliver: branch `claude/revamp-phase-<N-N>` from latest `main`, draft PR titled `Revamp <N.N>: <name>`, STATUS updated in the same PR (`in-review (PR #n)`), then subscribe to PR activity.
7. Invariants (non-negotiable, from ROADMAP §3): local-only mode fully working with no account; `richStateToPlain` contract preserved (`src/core/editor/richText.ts`); Dexie remains the local source of truth; Supabase strictly additive behind `VITE_SUPABASE_URL` (dynamic import only); all existing tests keep passing.
