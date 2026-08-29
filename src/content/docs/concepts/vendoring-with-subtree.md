---
title: Vendoring Core
description: Why Core is copied into each OS repo (except Windows) instead of referenced, how the copy is delivered and stamped, and the one command never to run.
section: Concepts
order: 1
---

# Vendoring Core

Core is authored once in `dotfiles-core` and **vendored** — copied in full — into every OS repo's
`core/` directory. Each machine repo therefore carries a real copy of Core, not a reference to it.

The one exception is `dotfiles-Windows`, which carries no `core/` at all: it replicates Core
natively in PowerShell and mirrors only the Neovim and starship configs via sync scripts. Everything
below describes the machine repos that do vendor Core.

## Why vendor at all

The payoff is **self-containment**: a fresh clone of any OS repo is complete and clone-and-go. There
is no second step, no empty directory, no "I cloned it and nothing works." Every machine repo is a
clean, public, standalone artifact.

## Why a copy, not a submodule

A **submodule** stores only a pointer. A fresh clone is empty until `git submodule update --init` —
the classic footgun. **Vendoring copies the actual files**, so the repo is whole on clone. The cost
is a duplicated tree living in each repo; that cost is bought back by two guardrails:

- **A sync script** that is the only sanctioned writer of the vendored copy.
- **An integrity check** that proves the copy still matches the Core commit it claims.

## How the copy is delivered

Core's `scripts/sync-core.sh` resolves Core **once**, up front, and materializes `core/` at that
exact commit — a pinned fetch, then the tree written into place. It is a replacement, not a merge:
`core/` is a pure copy, so "make it identical to Core at this commit" has exactly one correct answer
and needs no merge base. A `core/` that drifted for any reason is simply corrected by the next sync.

In the same commit, the script stamps **`core.lock`** at the repo root — outside `core/`, so a sync
cannot clobber it:

```ini
core_version=5.4.2
core_sha=a8b8e6e4…            # the FULL Core commit that was vendored
core_ref=v5.4.2-release       # the ref that was FOLLOWED
core_tag=v5.4.2               # once Core carries a tag describing that commit
```

That file is what makes "which Core is this box on?" answerable offline, and it is what
`core-integrity.sh` resolves to a tree and compares against your actual `core/`.

**You do not normally run any of this.** A release fans out from Core and arrives in each OS repo as
a pull request. Merge it, then re-link:

```bash
./bootstrap.sh --links-only
```

To run a sync by hand, do it **from a `dotfiles-core` checkout**, never from the consuming repo:

```bash
./scripts/sync-core.sh dotfiles-<OS>   # materializes core/ AND stamps core.lock
```

## Never `git subtree pull`

A raw `git subtree pull` moves `core/` but **not** `core.lock`. The integrity check then compares
your tree against a commit the lock no longer describes and reports `TAMPERED` — on a tree nobody
did anything wrong to. If you have already done it by hand, the fix is to re-run the fan-out from
Core, not to patch the lock.

The one `git subtree` still in play is the **one-time `git subtree add`** that creates a `core/`
where none exists — greenfield only, from a released tag (`refs/tags/v5`), never `main`, and never
the update path. `dotfiles-core`'s `scripts/new-os-repo.sh` runs it for you when scaffolding a new
OS repo.

## Why not chezmoi / stow / a bare repo

- **chezmoi / yadm** — one repo with per-OS templates is the most DRY answer, and the right move the
  day you want to collapse the fleet into one. This system keeps a multi-repo portfolio instead, so
  each machine is its own public artifact. Because Core is already plain and OS-agnostic, moving to
  chezmoi later would be a content migration, not a rewrite.
- **GNU stow** — a perfect zero-magic symlink farmer over a single repo, and simpler for one machine.
  It has no opinion about layering or per-OS divergence, which is exactly what this system needs.
- **A bare `$HOME` repo** — the leanest option solo, but no layer model, no per-OS story, and a real
  footgun on a shared box.

## The one rule that keeps it honest

**Never edit a vendored `core/` tree inside an OS repo.** That tree is a copy and is replaced
wholesale on the next sync — the edit is simply gone, committed or not. Fix the change in
`dotfiles-core`, green the audit, and fan it out — see
[Adding a file to Core](/docs/guides/adding-a-file-to-core).
