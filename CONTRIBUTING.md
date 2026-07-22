# Contributing to Verbalis

Thanks for your interest in Verbalis. A few things to know before you start.

## License context

Verbalis is **source-available, not open source** (see [`LICENSE.md`](LICENSE.md)).
The source is here so you can read it, self-host it, and use it as an individual
for free. Contributions are welcome, but by opening a pull request you agree that
your contribution is licensed under the same terms and that the maintainer may
relicense it as part of the project. For anything substantial, please open an
issue to discuss first.

## Development

Verbalis is a local-first React + TypeScript + Vite app. It runs 100% locally
with no account or backend.

```bash
pnpm install
pnpm dev            # start the dev server
pnpm test:unit      # unit tests (vitest)
pnpm test:e2e       # end-to-end (playwright)
pnpm typecheck      # tsc, no emit
pnpm lint           # eslint
pnpm format:check   # prettier check
pnpm build          # production build
```

- **Node** 20 (see `.nvmrc`) and **pnpm** (pinned via `packageManager` in
  `package.json`).
- The optional signed-in mode is behind `VITE_SUPABASE_*` — leave it unset to
  develop the local-only path. See [`docs/cloud.md`](docs/cloud.md).

## Before you open a PR

Every change must be green:

```bash
pnpm typecheck && pnpm lint && pnpm test:unit && pnpm build
```

Run `pnpm test:e2e` too for anything UI-facing. CI runs all of these.

## Conventions

- **Keep `core/*` pure.** Business logic goes in `src/core` as pure functions
  with injected I/O (`fetchImpl`, clients); push side effects to the edges. This
  is why the test suite is strong — keep it that way.
- **The optional cloud must tree-shake to zero** when unconfigured. Load Supabase
  only through the dynamic `getSupabase()` path; never import
  `@supabase/supabase-js` statically.
- **Match the surrounding code** — its naming, comment density, and idioms.
- Architecture notes live in [`docs/architecture.md`](docs/architecture.md).

## Reporting bugs / requesting features

Use the issue templates. For anything security-related, follow
[`SECURITY.md`](SECURITY.md) instead of opening a public issue.
