# Revamp prompt pack

One prompt file per phase of [`../ROADMAP.md`](../ROADMAP.md). Each is self-contained: paste it
into a fresh Claude Code session (web, app, or CLI) and it will implement exactly that phase and
open a draft PR. [`phase-runner.md`](./phase-runner.md) is the generic prompt used by the
scheduled daily Routine — it picks the next eligible phase from [`../STATUS.md`](../STATUS.md)
automatically, so you never fire the wrong phase.

Phase scope lives **only** in `ROADMAP.md §4` — the prompt files deliberately do not duplicate it,
so the roadmap can be amended without the pack drifting out of sync.

Sized for a Claude **Pro** subscription: one phase ≈ one focused session. Run at most one per
5-hour rate window; ~1 per day is the sustainable cadence. Manual runs on spare quota are safe —
`STATUS.md` keeps ordering consistent no matter who (or what) starts a session.
