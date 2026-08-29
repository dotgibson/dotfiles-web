---
title: Introduction
description: What the dotgibson dotfiles system is, the problem it solves, and how the documentation is organized.
section: Introduction
order: 0
---

# Introduction

**dotgibson** is a cross-platform terminal environment shipped as an **eleven-repo, three-layer**
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
| **OS-native** | `dotfiles-{MacBook,Fedora,Arch,Debian,openSUSE,Alpine,Gentoo}` | package manager, clipboard, paths |
| **Role** | `dotfiles-Offense` (offensive), `dotfiles-Defense` (defensive) | engagement / detection tooling on top of the OS layer |
| *Native host* | `dotfiles-Windows` | the Windows host: pwsh, Terminal, the WSL bridge |

`dotfiles-Windows` is the model's one named exception rather than a fourth layer — it vendors no
Core, replicating it natively in PowerShell.

Core is the **single source of truth**. It is authored here and **vendored** — copied in full —
into each OS repo, so every machine repo is self-contained and clone-and-go: no submodule flags, no
empty directories on a fresh clone.
See [The three-layer model](/docs/concepts/three-layer-model)
for how the layers compose, and [Vendoring Core](/docs/concepts/vendoring-with-subtree)
for how the copy is delivered and why vendoring beats the alternatives.

## How these docs are organized

- **Concepts** — the mental model: the layer split, vendoring, load order.
- **Guides** — how to actually work in the system: adding a Core file, cutting a release, syncing.
- **Reference** — the lookup material: aliases, bootstrap flags, the audit gate.

The per-repo READMEs stay deliberately lean and defer here for depth, so this hub is the canonical
long-form reference for the whole fleet.
