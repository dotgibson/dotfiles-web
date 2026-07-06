---
title: The three-layer model
description: How Core, OS-native, and Role layers compose — and the rule for deciding where any given change belongs.
section: Concepts
order: 0
---

# The three-layer model

Every piece of configuration in the system lives in exactly one of three layers. The layer you
put something in is decided by **one question: what does it change with?**

## The layers

| Layer | Lives in | Owns |
| --- | --- | --- |
| **Core** | `dotfiles-core`, vendored into every OS repo's `core/` | zsh modules, tmux, nvim, git, starship |
| **OS-native** | `dotfiles-{MacBook,Windows,Fedora,Arch,openSUSE,Alpine,Gentoo}` | package manager, clipboard, paths |
| **Role** | `dotfiles-Kali`, `dotfiles-Defense` | offensive / defensive tooling on the OS layer |

## The rule for where a change belongs

A change belongs in **Core** only if it is **identical on every machine**, **not OS-specific**, and
**not role-specific**. Concretely:

- **Changes with the OS → the OS repo.** Anything that differs by package manager, clipboard
  backend, or filesystem path is OS-native, not Core.
- **Changes with the operator's role → the role repo.** Offensive engagement tooling belongs in
  `dotfiles-Kali`; defensive detection tooling in `dotfiles-Defense`.
- **Everything else that's truly universal → Core.**

Core is authored once and **vendored** into each OS repo, so a defect in Core fans out to every
machine at once. That leverage is the whole point — and the reason Core changes go through a
single audit gate before they ship. See
[Vendoring with git subtree](/docs/concepts/vendoring-with-subtree) for how the fan-out works.

## Why split it this way

The alternative — one repo with per-OS conditionals — collapses under its own weight as the fleet
grows: the universal parts and the host-specific parts tangle together until no one can say what
is shared and what is not. The layer split keeps that boundary **explicit and auditable**: each OS
repo is a clean, self-contained, public artifact, and Core stays plain and OS-agnostic.

It is deliberately more structure than a single-machine setup needs. If you have one or two boxes
with no real OS spread, a bare `$HOME` git repo or GNU stow is far less ceremony — the layer model
earns its keep only across a genuine multi-OS fleet.
