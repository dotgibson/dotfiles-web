// Generates the bash + PowerShell installers served at /install, /install.sh and
// /install.ps1. The module allowlist is derived from src/data/modules.ts so the
// scripts and the builder UI can never disagree about which tokens are valid.
//
// SECURITY MODEL — why this is safe even though it's `curl … | bash`:
//   • The site is static (GitHub Pages). These scripts are FIXED files built at
//     deploy time; there is no server reflecting a request's query string into the
//     body. The `?modules=…` shape from the original blueprint is intentionally not
//     used — a server echoing a URL query into a piped-to-shell payload is a
//     reflected-injection / malicious-link vector.
//   • Module selection rides in as a positional ARGUMENT (`bash -s -- zsh,nvim`),
//     parsed locally and matched character-for-character against the allowlist
//     baked in below. An unknown token is reported and skipped — never executed.
//   • Nothing derived from the argument is ever eval'd or expanded into a command.
import { modulesFor, defaultTokens, type BuildModule } from '../data/modules';

// Repo slugs are constants from our own data, but escape anyway so a future edit
// with an odd character can't break out of the single-quoted heredoc/string.
const sq = (s: string) => s.replace(/'/g, `'\\''`);
const dq = (s: string) => s.replace(/(["`$\\])/g, '\\$1');

function bashAllowlist(): string {
  // token|label lines consumed by a case statement in the script. Scoped to Unix
  // modules so the bash installer never reports a Windows-only token (e.g. `ps`)
  // as valid — mirrors ps1Allowlist()'s windows scoping.
  return modulesFor('unix')
    .map((m) => `  ${m.id}) echo "${dq(m.label)} (${dq(m.repo)})" ;;`)
    .join('\n');
}

export function bashScript(baseUrl: string): string {
  const base = baseUrl.replace(/\/$/, '');
  const def = defaultTokens('unix');
  return `#!/usr/bin/env bash
set -euo pipefail

# dotfiles — modular bootstrap (generated, static; do not add server-side logic)
#
# Usage:
#   curl -sS '${sq(base)}/install' | bash -s -- ${def}
#
# Modules arrive as the first positional argument and are validated against a
# fixed allowlist below. Unknown tokens are reported and skipped — never run.
# This is the dynamic-builder entrypoint; the per-OS repos (clone + ./bootstrap.sh)
# remain the canonical install. Full guide:
#   ${base}/getting-started

REQUESTED="\${1:-${def}}"

describe_module() {
  case "$1" in
${bashAllowlist()}
    *) return 1 ;;
  esac
}

printf '\\xF0\\x9F\\x9A\\x80 dotfiles modular bootstrap\\n'
printf '   requested: %s\\n\\n' "$REQUESTED"

selected=()
IFS=',' read -ra _tokens <<< "$REQUESTED"
for _raw in "\${_tokens[@]}"; do
  # normalise: strip whitespace, lowercase
  tok="$(printf '%s' "$_raw" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')"
  [ -z "$tok" ] && continue
  if label="$(describe_module "$tok")"; then
    selected+=("$tok")
    printf '  \\xE2\\x9C\\x93 %-10s %s\\n' "$tok" "$label"
  else
    printf '  \\xE2\\x9A\\xA0  unknown module %s — skipped (not in allowlist)\\n' "$tok"
  fi
done

if [ "\${#selected[@]}" -eq 0 ]; then
  echo "No valid modules selected. Nothing to do."
  exit 0
fi

# Dependency hints (non-fatal — the per-OS bootstrap installs what's missing).
for cmd in git zsh nvim; do
  command -v "$cmd" >/dev/null 2>&1 || printf '  note: %s not found — install it before bootstrapping.\\n' "$cmd"
done

cat <<'NEXT'

Next: clone the repo for your platform and run its bootstrap — it wires the Core
modules above. Core is vendored, so a clone is self-contained.

  macOS            git clone https://github.com/Gerrrt/dotfiles-MacBook ~/dotfiles-MacBook
  Kali (WSL2)      git clone https://github.com/Gerrrt/dotfiles-Kali    ~/dotfiles-Kali
  Linux distros    git clone https://github.com/Gerrrt/dotfiles-Fedora  ~/dotfiles-Fedora

  cd ~/dotfiles-<platform> && ./bootstrap.sh

Full guide: ${base}/getting-started
NEXT
`;
}

function ps1Allowlist(): string {
  return modulesFor('windows')
    .map((m) => `  '${m.id}' { "${m.label.replace(/"/g, '`"')} (${m.repo})" }`)
    .join('\n');
}

export function ps1Script(baseUrl: string): string {
  const base = baseUrl.replace(/\/$/, '');
  const def = defaultTokens('windows') || 'nvim';
  // PowerShell array literal for the default, so `[string[]]` binds cleanly.
  const defArr = def
    .split(',')
    .map((t) => `'${t}'`)
    .join(',');
  return `# dotfiles — modular bootstrap for Windows (generated, static)
#
# Usage (passes modules as an argument to the downloaded script):
#   & ([scriptblock]::Create((irm '${base}/install.ps1'))) ${def}
#
# Modules are validated against a fixed allowlist; unknown tokens are skipped.
# The native Windows host lives in dotfiles-Windows; this mirrors the Unix flow.
#
# Accept [string[]] so an unquoted \`nvim,ps\` (which PowerShell parses as an array)
# binds correctly; join, then split, so a single quoted 'nvim,ps' works too.
param([string[]]$Modules = @(${defArr}))
$Requested = ($Modules -join ',')

function Get-ModuleLabel($id) {
  switch ($id) {
${ps1Allowlist()}
    default { $null }
  }
}

Write-Host "🚀 dotfiles modular bootstrap (Windows)" -ForegroundColor Cyan
Write-Host "   requested: $Requested"

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Warning "git not found — install Git for Windows before bootstrapping."
}

$selected = @()
foreach ($raw in $Requested.Split(',')) {
  $tok = $raw.Trim().ToLower()
  if (-not $tok) { continue }
  $label = Get-ModuleLabel $tok
  if ($label) {
    $selected += $tok
    Write-Host ("  + {0,-10} {1}" -f $tok, $label) -ForegroundColor Green
  } else {
    Write-Warning "unknown module '$tok' — skipped (not in allowlist)"
  }
}

if ($selected.Count -eq 0) {
  Write-Host "No valid modules selected. Nothing to do."
  return
}

Write-Host ""
Write-Host "Next: clone the Windows host repo and run its installer." -ForegroundColor Cyan
Write-Host "  git clone https://github.com/Gerrrt/dotfiles-Windows"
Write-Host "  cd dotfiles-Windows; .\\install.ps1"
Write-Host ""
Write-Host "Full guide: ${base}/getting-started"
`;
}

// Re-exported for callers/tests that want the raw module list alongside the scripts.
export type { BuildModule };
