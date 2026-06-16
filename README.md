<div align="center">

<img src="public/icons/icon.svg" width="96" height="96" alt="Verbalis" />

# VERBALIS

**Local-first CAT tool for translators who can't afford to leak a sentence.**

[Website](https://pedrobritx.github.io/EwP/) ·
[GitHub](https://github.com/pedrobritx/verbalis) ·
[LinkedIn](https://www.linkedin.com/in/pedrobritx/) ·
[Buy me a coffee](https://buymeacoffee.com/pedrobritx)

</div>

---

## Why Verbalis exists

Verbalis started with a stubborn problem: I needed to translate sensitive,
security-critical material and there was no tool I could fully trust. The
mainstream options wanted my documents on their servers. The privacy-respecting
ones couldn't speak the formats real translation work runs on — XLIFF, TMX,
TBX — so they never fit a professional CAT workflow.

So I built the tool I wanted: **local-first by default** — your files,
translation memory and glossaries never leave your browser — yet **fluent in the
industry's interchange formats**, so it slots into the same pipelines as memoQ,
Trados and OmegaT.

Verbalis is a CAT tool for people who handle confidential text. Privacy here
isn't a setting you toggle — it's the architecture.

## What that means in practice

- 🔒 **Local-first** — files, TM and glossaries live in your browser
  (IndexedDB). Nothing is uploaded; works fully offline as an installable PWA.
- 🛡️ **Built for confidential work** — designed for security-sensitive
  translation where the source text cannot leave the machine.
- 🔁 **Industry interoperable** — round-trips XLIFF 1.2, TMX, TBX, OmegaT and
  MultiTerm, so it drops into existing CAT pipelines.
- 🧠 **Smart assist** — translation memory, glossary matching and optional
  on-device semantic search to reuse past work.

## Tech

React + TypeScript + Vite, Tailwind, Dexie (IndexedDB), `vite-plugin-pwa`, and
`@xenova/transformers` for on-device embeddings. See
[`docs/architecture.md`](docs/architecture.md).

## Develop

```bash
pnpm install
pnpm dev            # start the dev server
pnpm test           # unit tests (vitest)
pnpm test:e2e       # end-to-end (playwright)
pnpm build          # production build
pnpm generate-icons # regenerate favicon / PWA icons from public/icons/icon.svg
```

## License

Verbalis is **source-available** (not OSI "open source"), under a two-tier
license — see [`LICENSE.md`](LICENSE.md):

- **Individuals — free.** Use it for your own work at no cost. The only rule:
  **credit the developer** and keep the link back to this project.
- **Organizations — get in touch.** Any team or company larger than one person
  needs a commercial license. Pricing is set individually and fairly —
  contact **pedrohbrito@me.com**.

---

<div align="center">

Created by **[Pedro Brito](https://github.com/pedrobritx)**. Made for
translators who keep secrets.

</div>
