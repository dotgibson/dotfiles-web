#!/usr/bin/env pwsh
<#
  dotfiles — Windows bootstrap launcher (https://github.com/Gerrrt)

  Served as a STATIC file from the showcase site. The host layer lives in
  dotfiles-Windows (PowerShell, Windows Terminal, scoop/winget, psmux); WSL distros
  configure themselves from their own repos and are intentionally not touched here.

  The Windows host install is a single unit — there is no per-module selection like
  the Linux/macOS side — so this launcher exposes the switches dotfiles-Windows's
  own install.ps1 actually understands and forwards them verbatim.

  Quick start:
    irm https://gerrrt.github.io/dotfiles-web/install.ps1 | iex

  To pass switches (piping to iex can't forward args, so create a scriptblock):
    $s = irm https://gerrrt.github.io/dotfiles-web/install.ps1
    & ([scriptblock]::Create($s)) -DryRun
    & ([scriptblock]::Create($s)) -SkipPackages

  Parameters (forwarded to dotfiles-Windows\install.ps1):
    -SkipPackages    only re-wire symlinks; skip the scoop/winget package layer.
    -DryRun          preview every change and mutate nothing.
    -Dest DIR        where to clone the repo (default: $HOME).
#>
[CmdletBinding()]
param(
  [switch] $SkipPackages,
  [switch] $DryRun,
  [string] $Dest = $HOME
)
$ErrorActionPreference = 'Stop'

$Owner  = 'Gerrrt'
$Repo   = 'dotfiles-Windows'
$Url    = "https://github.com/$Owner/$Repo"
$Target = Join-Path $Dest $Repo

Write-Host "🤖 dotfiles installer (Windows)"
Write-Host "   repo    : $Repo"
Write-Host "   target  : $Target"
if ($DryRun)       { Write-Host "   mode    : dry run (no changes will be made)" }
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

# Forward only the switches the underlying installer actually accepts, so a flag
# passed here genuinely takes effect (no validated-but-ignored parameters).
$bootstrapArgs = @()
if ($SkipPackages) { $bootstrapArgs += '-SkipPackages' }
if ($DryRun)       { $bootstrapArgs += '-DryRun' }

Write-Host "⚙️  .\install.ps1 $($bootstrapArgs -join ' ')"
& $installer @bootstrapArgs

Write-Host ""
Write-Host "✅ done. Open a new PowerShell window to load your configured profile."
