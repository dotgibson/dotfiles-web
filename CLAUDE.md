# CLAUDE.md — dotfiles-web

Project memory for Claude Code, auto-loaded every session. The system's
source-of-truth rules live in [dotfiles-core](https://github.com/Gerrrt/dotfiles-core).

## What this repo is

`dotfiles-web` is the **public showcase + docs site** for a nine-repo dotfiles
system built on a three-layer model (Core → OS-native → Role). It *documents* the
system rather than configuring a machine, so it is **not** itself one of the three
layers. Built with **Astro**, themed in **Tokyo Night**, deployed to **GitHub
Pages**.

## The rule that bites

Because this site restates facts that live elsewhere — the repo count, the
three-layer model, per-platform install commands — it is the easiest place for
documentation to drift from reality. Treat the source-of-truth repos as canonical
and keep the site in step. The `/doc-audit` routine in dotfiles-core checks exactly
this cross-repo consistency; run it before publishing claims.

## Where things are

- `src/` — Astro pages + components (landing, getting-started, architecture, changelog)
- `astro.config.mjs`, `package.json` — build config
- `public/` — static assets
- `scripts/` — site tooling (e.g. changelog mirroring)
