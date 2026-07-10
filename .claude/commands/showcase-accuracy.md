---
description: Cross-check the showcase site's claims against the source-of-truth repos (report-first)
argument-hint: "[page or claim, optional — e.g. getting-started, architecture, repo-count]"
allowed-tools: Read, Grep, Glob, Bash(git ls-files:*), Bash(ls:*)
---

# /showcase-accuracy

dotfiles-web *restates* facts that live in other repos — the repo count, the
three-layer model, per-platform install commands, the Core version, the
corpus/detection counts. That makes it the easiest place in the fleet for docs to
drift from reality. Find where the rendered site disagrees with the source of truth.
This is the web-side twin of Core's `/doc-audit`.

Scope for this run: **$ARGUMENTS** (empty = the whole site).

## Baseline first — trust the generated data, check the prose

- `src/data/generated.json` + `corpus.json` + `coverage.json` are **machine-generated**
  from the fleet by `scripts/collect-*.mjs`, and CI's `data-freshness` gate keeps them
  fresh. Treat them as ground truth for counts/versions — do **not** re-derive them.
- The drift this routine catches is in the **hand-written prose / components**
  (`src/pages/**`, `src/components/**`, `README.md`): a hard-typed number, install
  command, or claim that contradicts either `generated.json` or the actual source repo.
- The fleet is checked out as siblings (via `--add-dir`) — the OS repos'
  `bootstrap.sh` / `install/`, Core's `README.md` / `core.manifest` / `scripts/os-repos.txt`.

## What to check

1. **Counts & versions in prose vs `generated.json`.** Any hard-typed "N repos",
   "M pairs", Core version, or layer count in a page/component that `generated.json`
   (or `corpus.json`) contradicts — the site should read from the data, not restate it.
2. **The three-layer model + repo inventory.** The architecture page's description of
   Core → OS-native → Role, and which repos sit in each layer, vs the actual fleet
   (Core's `README.md` table + `scripts/os-repos.txt`). Flag a repo miscategorized,
   missing, or renamed.
3. **Per-platform install / getting-started commands.** The commands the
   getting-started page shows for each OS vs that OS repo's real `bootstrap.sh`
   entrypoint + `install/` conventions. Flag a command that wouldn't work as written
   (wrong script name, wrong flag, a distro whose real bootstrap differs).
4. **Cross-repo claims that moved.** A capability the site describes that a source repo
   has since changed or removed (a routine, a tool, a feature named in the copy).

## How to report

Group by severity, cite `src/…:line` and the source-of-truth `file:line` it disagrees
with, plus the one-line fix:

- **Drift (fix needed)** — a concrete contradiction with the source or the generated
  data.
- **Stale (likely)** — probably outdated, needs your call.
- **Clean** — what was checked and matched, so a green run is trustworthy.

Report-first. Fixes land in `dotfiles-web` prose/components — or, better, wire the
value to read from `generated.json` so it can't drift again. Do not edit anything
unless I explicitly ask.
