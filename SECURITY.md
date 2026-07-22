# Security Policy

Verbalis is a privacy-first, local-first CAT tool: by design, your files,
translation memory and glossaries stay in your browser. Security reports are
taken seriously.

## Reporting a vulnerability

**Please do not open a public issue for security vulnerabilities.**

Instead, email **pedrobritx@gmail.com** with:

- a description of the issue and its impact,
- steps to reproduce (a proof of concept if you have one),
- the affected version / build (the About page shows the build SHA).

You can expect an acknowledgement within a few days. Please give a reasonable
window to investigate and ship a fix before any public disclosure.

## Scope

Especially relevant for this project:

- anything that could cause user data (source text, TM, glossaries) to **leave
  the device** unexpectedly in local-only mode,
- issues in the optional signed-in mode (Supabase auth, RLS, cloud sync,
  collaboration) that could expose one user's data to another,
- the storage-connector OAuth flows (Google Drive, OneDrive).

## Out of scope

- Vulnerabilities in third-party dependencies without a demonstrated exploit in
  Verbalis (report those upstream).
- Anything requiring physical access to an unlocked device.
