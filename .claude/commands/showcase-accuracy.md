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

## Baseline first — know how far the generated data is actually verified

Four files under `src/data/` are machine-generated from the fleet by
`scripts/collect-*.mjs`. **They are not equally verified.** Treating them as uniformly
certified is how a run ends up certifying a value nothing ever checked. What CI actually
guarantees:

| file | source | what CI verifies |
| --- | --- | --- |
| `generated.json` | the ten dotfiles repos | **only the Core version string** |
| `corpus.json` | `htpx/entries/{red,blue}/*.md` | full content, regenerated and diffed |
| `coverage.json` | `dotfiles-Defense/detections/sigma/**/*.yml` | full content, regenerated and diffed |
| `snippets.json` | six repos' config files (Core, four OS, Offense) | full content, regenerated and diffed |

- **`generated.json` is the weakly-checked one.** `data-freshness`'s `check` job compares
  `.releases.current` / `.drift.coreVersion` against the latest `dotfiles-core` release
  and *nothing else*. Package counts, CI flags, the changelog, `fleet.publicRepos`, every
  `core.*` metric and all nine per-repo `drift` entries are unvalidated — that is exactly
  how a bogus `dotfiles-Windows` drift entry once sat in a file CI called fresh. A
  surprising value here is a **lead to check against the source repo**, not a fact.
- **`corpus.json` / `coverage.json` / `snippets.json` are content-gated** by
  `data-freshness`'s `derived-data` job (it clones all eight source repos, re-runs the
  three collectors, and fails on any difference) and refreshed weekly by `fleet-sync`.
  All three carry a `generatedAt` date — **read the stamp**; if it predates recent
  activity in the source repo, say so rather than certifying the numbers.
  - The stamp shapes differ. `corpus.json` / `coverage.json` carry a flat
    `generatedFrom.commit` for their single source. `snippets.json` spans six repos, so
    its SHAs are per-repo under `generatedFrom.repos.<name>.commit`, alongside a
    `generatedFrom.clean` verdict — looking for a top-level `.commit` there finds
    nothing and proves nothing.
  - `snippets.json` was outside this gate until #149, and went stale that way once
    already. Treat a `generatedAt` predating that as unverified regardless of the gate.
- **Re-derive when a number looks wrong.** The sources are named in the table above and
  are checked out as siblings, so a count can always be confirmed rather than assumed.
- The drift this routine catches is in the **hand-written prose / components**
  (`src/pages/**`, `src/components/**`, `README.md`): a hard-typed number, install
  command, or claim that contradicts a source repo or the generated data.
- The fleet is checked out as siblings (via `--add-dir`) — the OS repos'
  `bootstrap.sh` / `install/`, Core's `README.md` / `core.manifest` / `scripts/os-repos.txt`.

## What to check

1. **Counts & versions in prose vs the generated data.** Any hard-typed "N repos",
   "M pairs", Core version, or layer count in a page/component that `generated.json` or
   `corpus.json` contradicts — the site should read from the data, not restate it. When
   the two disagree, work out which one is wrong before writing it up: the prose is the
   usual culprit, but an unvalidated `generated.json` field is a real possibility.
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
- **Stale (likely)** — probably outdated, needs your call. A `generatedFrom.commit` that
  has fallen behind its source repo belongs here.
- **Clean** — what was checked and matched, so a green run is trustworthy. Only list
  something as clean if you actually verified it against a source; "the generated data
  says so" is not a check when the field in question is one CI never looks at.

Report-first. Fixes land in `dotfiles-web` prose/components — or, better, wire the
value to read from `generated.json` so it can't drift again. Do not edit anything
unless I explicitly ask.
