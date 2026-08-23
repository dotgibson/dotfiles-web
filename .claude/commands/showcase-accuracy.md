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
`scripts/collect-*.mjs`. Since #150/#160 all four are verified the same way — which is a
change from what this routine used to say, so check the stamp before trusting an older
snapshot. What CI actually guarantees:

| file | source | what CI verifies |
| --- | --- | --- |
| `generated.json` | the eleven dotfiles repos | full content, regenerated and diffed (+ the Core version string) |
| `corpus.json` | `htpx/entries/{red,blue}/*.md` | full content, regenerated and diffed |
| `coverage.json` | `dotfiles-Defense/detections/sigma/**/*.yml` | full content, regenerated and diffed |
| `snippets.json` | six repos' config files (Core, four OS, Offense) | full content, regenerated and diffed |

- **All four are content-gated** by `data-freshness`'s `derived-data` job — it clones the
  twelve source repos, re-runs all four collectors, and fails on any difference — and are
  refreshed by `fleet-sync`. Which commit of each repo it clones depends on the event; see
  the bullet on that below before leaning on a green tick. All four carry a `generatedAt` date; **read the stamp**, and
  if it predates recent activity in the source repo say so rather than certifying the
  numbers.
- **`generated.json` used to be the weakly-checked one, and that is what changed.** It was
  never outside a gate — `check` has always compared `.releases.current` /
  `.drift.coreVersion` against the latest `dotfiles-core` release — but that is one string
  out of ~2200 lines, so package counts, CI flags, the changelog, `fleet.publicRepos`,
  every `core.*` metric and all ten per-repo `drift` entries went unvalidated. That is
  exactly how a bogus `dotfiles-Windows` drift entry once sat in a file CI called fresh.
  Those fields are now gated, so a value here is a fact rather than a lead — **but only in
  a snapshot generated after #150/#160**. In anything older, treat every non-version field
  as unverified.
- **The two `generated.json` guards ask different questions**, and knowing which one a
  value satisfies matters. `check` asks "does this name the latest *release*?";
  `derived-data` asks whether regenerating reproduces the committed file. So a figure can
  be CI-verified and still describe an unreleased Core.
- **`derived-data` regenerates against a different fleet state depending on how it ran**,
  and this decides how much a green tick is worth to an audit. On a **pull request** it
  clones each repo at the commit the file's own `generatedFrom` stamps name, so green means
  "these bytes are what those commits produce" — provenance, not freshness. On the
  **Monday cron and `workflow_dispatch`** it clones at HEAD, so green there means "the
  fleet has not moved past this file" — the drift alarm. Green on a PR alone therefore does
  NOT certify a figure as current; **read `generatedAt` and the stamped SHAs** and check
  them against the source repo before treating a number as up to date. (The split exists
  because cloning HEAD on a PR made every `fleet-sync` refresh a race it lost by standing
  still — the fleet moved while the PR waited for review, and the bot's faithful snapshot
  was reported as stale.)
- The stamp shapes differ. `corpus.json` / `coverage.json` carry a flat
  `generatedFrom.commit` for their single source. `snippets.json` spans six repos and
  `generated.json` eleven, so both put their SHAs per-repo under
  `generatedFrom.repos.<name>.commit` alongside a `generatedFrom.clean` verdict (the two
  stamps were deliberately unified in #148) — looking for a top-level `.commit` in either
  finds nothing and proves nothing.
- `snippets.json` was outside the content gate until #149 and `generated.json` until
  #150/#160, and both went stale that way. Treat a `generatedAt` predating those as
  unverified regardless of the gate.
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
