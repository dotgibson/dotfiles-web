---
title: Alias reference
description: The aliases and shortcuts Core ships — modern-CLI swaps, navigation, and the OMZ-compatible git suite.
section: Reference
order: 0
---

# Alias reference

Core ships a curated set of aliases from `zsh/20-aliases.zsh` and `zsh/25-git.zsh`. The modern-CLI
swaps are **guarded by detection flags**: `00-tools.zsh` sets `HAVE_*` at load time, and each alias
only activates if the tool is installed — otherwise the classic command is used. Nothing breaks on
a box without the newer tool; things just get nicer where they can.

> This mirrors `dotfiles-core`'s [`aliases.md`](https://github.com/dotgibson/dotfiles-core/blob/main/aliases.md)
> cheat sheet. Run `core help` (aliased `cheat`) in the shell for the always-current index.

## Modern CLI replacements

| Alias | Expands to | Requires |
| --- | --- | --- |
| `ls` / `ll` / `la` | `eza` (icons, git status, grouped) | eza |
| `lt` / `llt` / `tree` | `eza --tree` | eza |
| `cat` | `bat --paging=never` | bat |
| `cd` / `cdi` | `zoxide` jump (`z` / `zi`) | zoxide |
| `du` | `dust` | dust |
| `df` | `duf` | duf |
| `ps` | `procs` | procs |
| `top` / `htop` | `btop` | btop |
| `rg` | `rg --smart-case` | ripgrep |
| `fd` | `fd` / `fdfind` | fd-find |
| `fm` / `y` | `yazi` | yazi |
| `http` / `https` | `xh` | xh |
| `md` | `glow --pager` | glow |
| `dns` | `doggo` | doggo |
| `ping` | `gping` | gping |
| `watch` | `viddy` | viddy |
| `help` | `tldr` | tldr |

## Editors & launchers

| Alias | Expands to |
| --- | --- |
| `vim` | `nvim` |
| `lg` | `lazygit` |
| `notes` | `cd "$NOTES_DIR" && nvim .` |
| `cheat` | `core-help` (the built-in help index) |

## Navigation & safety

| Alias | Expands to |
| --- | --- |
| `-` | `cd -` (previous directory) |
| `mkdir` | `mkdir -p` (create parents) |
| `rm` / `cp` / `mv` | interactive (`-i`) |
| `diff` | `diff --color=auto` |
| `myip` | `curl -fsS https://ifconfig.me` |
| `ports` | `ss -tulpn` (falls back to `netstat`) |

## Git suite (OMZ-compatible)

Sourced from `zsh/25-git.zsh`. A representative slice — see the shell's `core help` for the full set.

| Alias | Expands to |
| --- | --- |
| `g` | `git` |
| `gst` / `gss` | `git status` / `--short` |
| `ga` / `gaa` / `gap` | `git add` / `--all` / `--patch` |
| `gc` / `gcm` / `gcam` | `git commit -v` / `-m` / `-am` |
| `gco` / `gcb` / `gsw` | `git checkout` / `-b` / `git switch` |
| `gd` / `gds` | `git diff` / `--staged` |
| `glog` / `glola` | pretty graph log / all branches |
| `gp` / `gpf` | `git push` / `--force-with-lease` |
| `gl` / `gpr` | `git pull` / `--rebase` |
| `grb` / `grbi` / `grbc` | `git rebase` / `-i` / `--continue` |
| `gsta` / `gstp` | `git stash push` / `pop` |

## Interactive helpers

A few commands are functions, not aliases — they wrap `fzf`:

- `gaf` / `grf` / `grsf` — fuzzy add / restore / restore-staged.
- `fif` / `fbr` — fuzzy find-in-files / branch checkout.
- `gsync` — push an OS repo's vendored `core/` subtree back upstream to `dotfiles-core`.
