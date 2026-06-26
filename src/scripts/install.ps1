#!/usr/bin/env pwsh
<#
  dotfiles — Windows bootstrap launcher (https://github.com/Gerrrt)

  Served as a STATIC file from the showcase site. The host layer lives in
  dotfiles-Windows (PowerShell, Windows Terminal, scoop/winget, psmux); WSL distros
  configure themselves from their own repos and are intentionally not touched here.

  Quick start (Core defaults):
    irm https://gerrrt.github.io/dotfiles-web/install.ps1 | iex

  With module selection (piping to iex can't pass args, so create a scriptblock):
    $s = irm https://gerrrt.github.io/dotfiles-web/install.ps1
    & ([scriptblock]::Create($s)) -Modules core,psmux

  Parameters:
    -Modules a,b     components to include (default: core). 'psmux' = native tmux-alike.
    -SkipPackages    only re-wire symlinks; skip the scoop/winget package layer.
    -Dest DIR        where to clone the repo (default: $HOME).
#>
[CmdletBinding()]
param(
  [string[]] $Modules = @('core'),
  [switch]   $SkipPackages,
  [string]   $Dest = $HOME
)
$ErrorActionPreference = 'Stop'

$Owner  = 'Gerrrt'
$Repo   = 'dotfiles-Windows'
$Url    = "https://github.com/$Owner/$Repo"
$Target = Join-Path $Dest $Repo

# Validate module tokens so a typo fails loudly rather than silently doing nothing.
foreach ($m in $Modules) {
  if ($m -notmatch '^[a-z0-9]+$') {
    Write-Error "install: invalid module token '$m' (expected e.g. core, psmux)"; exit 2
  }
}

Write-Host "🤖 dotfiles installer (Windows)"
Write-Host "   modules : $($Modules -join ',')"
Write-Host "   repo    : $Repo"
Write-Host "   target  : $Target"
if ($SkipPackages) { Write-Host "   mode    : links only (skipping packages)" }
Write-Host ""

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Error "install: git is required but was not found on PATH"; exit 1
}

if (Test-Path (Join-Path $Target '.git')) {
  Write-Host "📂 $Target already exists — updating"
  git -C $Target pull --ff-only
} else {
  Write-Host "📦 cloning $Url"
  git clone --depth 1 $Url $Target
}

Set-Location $Target
$installer = Join-Path $Target 'install.ps1'
if (-not (Test-Path $installer)) {
  Write-Error "install: $installer not found"; exit 1
}

$bootstrapArgs = @()
if ($SkipPackages) { $bootstrapArgs += '-SkipPackages' }

Write-Host "⚙️  .\install.ps1 $($bootstrapArgs -join ' ')"
& $installer @bootstrapArgs

Write-Host ""
Write-Host "✅ done. Open a new PowerShell window to load your configured profile."
