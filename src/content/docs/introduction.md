---
title: Introduction
description: What the dotgibson dotfiles system is, the problem it solves, and how the documentation is organized.
section: Introduction
order: 0
---

# Introduction

**dotgibson** is a cross-platform terminal environment shipped as a **ten-repo, three-layer**
dotfiles system. The goal is a single, opinionated setup — shell, editor, multiplexer, prompt,
git — that stays **identical on every machine you touch**, with no productivity gaps when you
hop between them and no per-host drift creeping in over time.

## The problem it solves

Most dotfiles start as one repo for one machine. The moment a second OS enters the picture, that
repo grows host branches, `if [[ "$OSTYPE" ... ]]` thickets, and a slow divergence that nobody
can fully audit. dotgibson takes the opposite bet: **factor the parts that are truly universal
into a Core that is authored once, and let each machine layer only its own differences on top.**

## The three layers

| Layer | Lives in | Owns |
| --- | --- | --- |
| **Core** | `dotfiles-core`, vendored into every OS repo's `core/` | zsh, tmux, nvim, git, starship — identical everywhere |
| **OS-native** | `dotfiles-{MacBook,Windows,Fedora,Arch,openSUSE,Alpine,Gentoo}` | package manager, clipboard, paths |
| **Role** | `dotfiles-Kali` (offensive), `dotfiles-Defense` (defensive) | engagement / detection tooling on top of the OS layer |

Core is the **single source of truth**. It is authored here and **vendored** into each OS repo via
`git subtree`, so every machine repo is self-contained and clone-and-go — no submodule flags, no
empty directories on a fresh clone. See [The three-layer model](/docs/concepts/three-layer-model)
for how the layers compose, and [Vendoring with git subtree](/docs/concepts/vendoring-with-subtree)
for why subtree over the alternatives.

## How these docs are organized

- **Concepts** — the mental model: the layer split, vendoring, load order.
- **Guides** — how to actually work in the system: adding a Core file, cutting a release, syncing.
- **Reference** — the lookup material: aliases, bootstrap flags, the audit gate.

The per-repo READMEs stay deliberately lean and defer here for depth, so this hub is the canonical
long-form reference for the whole fleet.
