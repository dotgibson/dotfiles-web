---
title: The audit gate
description: What scripts/audit-core.sh checks, and the make targets that run it — the single definition of "Core is healthy".
section: Reference
order: 1
---

# The audit gate

`scripts/audit-core.sh` is the **single definition of "Core is healthy."** Because Core fans out
to every OS repo via `git subtree`, a defect here is an N-way defect — so nothing is vendored out
until the gate is green. CI, the pre-commit hook, and `make audit` all call the same script, so
"passes locally" and "passes in CI" mean the same thing.

## What it checks

| Check | What it proves |
| --- | --- |
| **Manifest ↔ filesystem** | Every `core.manifest` path exists, and every tracked Core file is listed (or allowlisted). No drift in either direction. |
| **Exec bits** | Scripts (`bin/`, `scripts/`, `tmux/scripts/`, `maint/`) are `+x`; sourced `zsh/*.zsh` modules are **not**. |
| **Shell syntax** | `bash -n` / `zsh -n` over every script and module. |
| **Lint** | shellcheck (bash), luacheck (nvim), markdownlint (docs). |
| **Config** | TOML / YAML / JSON parse cleanly. |
| **Workflows** | actionlint over `.github/workflows`. |
| **Secrets** | gitleaks over the working tree. |
| **Version** | `core.version` is well-formed and has a matching `CHANGELOG` heading; tool checksums are pinned. |
| **Behavioral** | a hermetic test suite — load-order smoke test, function units, clipboard ladder, nvim headless load, and more. |

Some linters **skip** gracefully when the tool isn't installed locally. A skip is not a pass — CI
installs the full toolchain, so treat a green local run with skips as partial until CI confirms.

## The make targets

```sh
make audit          # the full gate
make audit-changed  # only the gates your diff touches (fast inner loop)
make sync           # fan Core out to every OS repo — only after a green audit
```

Run `make` with no target for the full list of entry points.

## The workflow

1. Make your change in `dotfiles-core` (never in a vendored `core/` — see
   [Vendoring with git subtree](/docs/concepts/vendoring-with-subtree)).
2. `make audit-changed` while iterating; `make audit` before you push.
3. Record the change in `CHANGELOG.md` under `[Unreleased]` with a Conventional Commits message.
4. Once green, `make sync` fans it out to the fleet.

A red tree must never be vendored out — that is the whole contract.
