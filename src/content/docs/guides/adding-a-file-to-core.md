---
title: Adding a file to Core
description: The manifest contract, load order, exec-bit rules, and the audit gate a new Core file must pass before it fans out.
section: Guides
order: 0
---

# Adding a file to Core

Core is vendored into every OS repo, so adding a file here is not a local edit — it is a change
that ships to the whole fleet on the next sync. Four things keep that safe.

## 1. The manifest is the contract

`core.manifest` is the canonical inventory of what Core ships. **Adding a Core file means adding its
path to `core.manifest` in the same change.** The audit enforces this in both directions: a manifest
path with no file fails, and a tracked Core file with no manifest entry fails.

Repo-meta and dev tooling — docs, `.github/`, `.claude/`, `scripts/`, README media — are not shipped
Core; they live in the audit's allowlist instead of the manifest.

## 2. Load order is load-bearing

Sourced zsh modules load in a fixed order, and it matters — detection flags must be set before the
aliases that read them, options before history, and so on:

```text
tools → ui → options → history → aliases → git → functions → fzf → bindings → plugins → op → maint → update → os → local
```

Add a new module in the position its dependencies require; don't reorder casually.

## 3. Exec bits are asserted

The audit checks file modes, so get them right:

- Runnable scripts (`bin/`, `scripts/`, `tmux/scripts/`, `maint/` runners) must be executable (`+x`).
- Sourced `zsh/*.zsh` modules must **not** be executable — they are read, not run.

## 4. Green the audit before you push

`scripts/audit-core.sh` is the single definition of "Core is healthy" — manifest drift, exec bits,
shell/lua syntax, shellcheck, markdownlint, and a behavioral test suite. CI, pre-commit, and
`make audit` all call it.

```sh
make audit          # the full gate
make audit-changed  # only what your diff touches (fast loop)
```

A red tree must never be vendored out. Once the audit is green, `make sync` fans Core out to every
OS repo.

## The short version

1. Add the file, and add its path to `core.manifest` in the same commit.
2. Name a new zsh module as a numbered fragment (`NN-name.zsh`) so the loader globs it in the right place — pick the `NN` prefix for its band (Core `00`–`69`; the OS layer is `80`, role stages `85`, host-local `99`).
3. Set exec bits: scripts `+x`, `zsh/*.zsh` not executable.
4. Run `make audit` until it's green, then `make sync` to fan it out.
5. Record the change in `CHANGELOG.md` under `[Unreleased]` with a Conventional Commits message.
