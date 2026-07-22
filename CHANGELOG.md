# Changelog

Notable changes to Verbalis. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/).

## [Unreleased] — polish pass ("Snow Leopard")

A refinement release: correctness, coherence, and repo standards — no new
features.

### Fixed

- Contact email corrected to `pedrobritx@gmail.com` across the app, README and
  LICENSE.
- Sidebar / status-filter active highlight now adapts to the light theme (it
  hardcoded the dark-theme accent) via a new `--color-accent-subtle` token.
- Top-bar breadcrumb no longer shows raw paths for `/corpora`, `/addons`,
  `/guide`, `/about`.

### Changed

- Personal / portfolio links now point at the `britx.me` domain.
- **Quick lookup follows the open project's languages.** Opening lookup from
  inside a project defaults its source/target to that project instead of the
  global lookup defaults; the import dialog seeds its pair from your history
  (distinct `pt→en` fallback for this PT↔EN-oriented tool) instead of a fixed
  `en→es`, and remembers the pair you import with.
- **Signed-in users are attributed by their account name.** Tracked changes,
  comments, collaboration presence and version sign-off use your account name
  automatically; Settings no longer asks for a separate local name when signed
  in. The device-local author id is unchanged.
- The first-run welcome screen is a proper hero (brand, value props, three-step
  flow); shared links and PWA installs get Open Graph / Twitter / theme-color
  metadata.

### Added

- **Tooling the repo lacked:** ESLint (flat config) + Prettier + knip +
  `.editorconfig` / `.nvmrc`, with `lint` and `format:check` wired into CI.
- Contributor hygiene: `CONTRIBUTING.md`, `SECURITY.md`, PR + issue templates,
  and a `docs/` index.

### Removed

- Dead code: an unused `tooltip` UI primitive, an orphaned `dictionary` feature,
  an unused schema barrel, and the unused `jimp` / `@radix-ui/react-tooltip`
  dependencies.

### Internal

- Name-fallback logic centralised in `features/account/displayName.ts`.
- Repo-wide `prettier --write` isolated in one commit (see
  `.git-blame-ignore-revs`).
- Historical planning docs moved under `docs/history/`.

---

Earlier history (the six-milestone Verbalis 2.0 "Translation IDE" revamp —
tracked changes, comments, accounts, real-time collaboration, roles, extensions
& connectors) is recorded in [`docs/revamp/STATUS.md`](docs/revamp/STATUS.md).
