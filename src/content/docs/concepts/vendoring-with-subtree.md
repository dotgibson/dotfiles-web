---
title: Vendoring with git subtree
description: Why Core is vendored into each OS repo with git subtree instead of a submodule, and how the copy is kept honest.
section: Concepts
order: 1
---

# Vendoring with git subtree

Core is authored once in `dotfiles-core` and **vendored** — copied in full — into every OS repo's
`core/` directory using `git subtree`. Each machine repo therefore carries a real copy of Core,
not a reference to it.

## Why vendor at all

The payoff is **self-containment**: a fresh clone of any OS repo is complete and clone-and-go. There
is no second step, no empty directory, no "I cloned it and nothing works." Every machine repo is a
clean, public, standalone artifact.

## Why subtree, not submodule

A **submodule** stores only a pointer. A fresh clone is empty until `git submodule update --init` —
the classic footgun. **Subtree vendors the actual files**, so the repo is whole on clone. The cost
subtree pays is a vendored copy living in each repo; that cost is bought back by two guardrails:

- **A sync script** that moves Core changes in and out of the vendored copy in one direction at a time.
- **A manifest audit** that proves the vendored copy matches Core and that nothing has drifted.

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

**Never edit a vendored `core/` tree inside an OS repo.** That tree is a copy and is overwritten on
the next sync. Fix the change in `dotfiles-core`, green the audit, and fan it out — see
[Adding a file to Core](/docs/guides/adding-a-file-to-core).
