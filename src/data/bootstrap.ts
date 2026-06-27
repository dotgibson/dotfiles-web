// Data model for the Bootstrap Command Generator (Track A — see
// docs/interactive-features-design.md §1). The page renders ENTIRELY from this
// list: a target is a platform/repo with the EXACT set of flags its real
// bootstrap accepts. Adding a platform or flag is a data edit here, nothing else.
//
// THE CONTRACT (design doc §0 verification tier): every `flag` token below must
// be one the repo's bootstrap actually parses. Unknown flags hard-fail on macOS
// (its bootstrap validates against a KNOWN_FLAGS allowlist) and are wrong
// everywhere else, so a target only ever lists flags it genuinely supports.
// Verified against each repo's bootstrap.sh / install.ps1 case-arms:
//   Fedora/Arch/openSUSE: --links-only --no-flatpak  + --only/--skip (modules)
//   Alpine:               --links-only               + --only/--skip (modules)
//   Gentoo:               --links-only --no-sync      + --only/--skip (modules)
//   Kali:                 --links-only --no-offensive + --only/--skip (modules)
//   macOS:                --links-only --no-brew --macos-defaults --set-shell --dry-run
//                          + --only/--skip (modules)
//   Windows (install.ps1): -SkipPackages -DryRun
// Every repo that vendors core/lib/bootstrap-lib.sh now accepts --only/--skip module
// selection (Track B); `modules: true` opts a target into the UI. Windows has no
// vendored Core, so it carries no module groups.
// Re-verify after any bootstrap change — scripts/verify-bootstrap-flags.mjs guards it.

export type Dialect = 'sh' | 'ps';

export interface BootstrapFlag {
  key: string; // stable id for UI state (unique within a target)
  label: string; // plain-language choice shown to the user
  flag: string; // the LITERAL token emitted, e.g. '--no-offensive'
  help: string; // one-line explanation under the label
  kind: 'provision' | 'safety'; // groups the checkboxes in the UI
  default?: boolean; // pre-checked? (defaults to false → full install)
}

export interface BootstrapTarget {
  id: string; // 'macos', 'kali', 'fedora', ...
  label: string; // tab label
  repo: string; // repo slug under Gerrrt
  dialect: Dialect; // drives clone form, prompt glyph, and flag syntax
  entry: string; // './bootstrap.sh' | '.\\install.ps1'
  cloneDir?: string; // sh only; defaults to ~/<repo> when unset
  blurb: string; // one line shown above the options
  flags: BootstrapFlag[]; // only the flags THIS target really accepts
  modules?: boolean; // does this bootstrap accept --only/--skip module selection?
  notes?: string[]; // post-install reminders rendered below the command
}

// The Core wiring groups a `modules: true` target can narrow with --only/--skip
// (the shared core/lib/bootstrap-lib.sh scaffold — see dotfiles-core). All six are
// linked by default; the generator emits --only/--skip ONLY when a subset is chosen.
// The keys MUST match BLIB_MODULES in bootstrap-lib.sh exactly.
export interface ModuleGroup {
  key: string; // the literal group token emitted in --only/--skip (e.g. 'zsh')
  label: string; // plain-language name
  help: string; // one-line "what it links"
}
export const moduleGroups: ModuleGroup[] = [
  { key: 'zsh', label: 'Zsh', help: 'shell module chain, the OS zsh overlay, the managed ~/.zshrc loader + default shell' },
  { key: 'nvim', label: 'Neovim', help: 'the Neovim config tree (and the stock-vim fallback)' },
  { key: 'tmux', label: 'tmux', help: 'tmux config + reset, popup scripts, the OS overlay, and tpm' },
  { key: 'git', label: 'Git', help: 'Core gitconfig, the OS git overlay, and the seeded local identity' },
  { key: 'prompt', label: 'Starship prompt', help: 'the starship.toml theme' },
  { key: 'tools', label: 'CLI tools', help: 'lazygit, mise, the clip helpers, ssh config, and the seeded sesh config' },
];

// ── reusable flag definitions (shared across the Linux distro targets) ───────
const linksOnly: BootstrapFlag = {
  key: 'links-only',
  label: 'Config only — skip package install',
  flag: '--links-only',
  help: 'Re-wire the dotfile symlinks without touching the package manager. For when your tools are already installed.',
  kind: 'provision',
};
const noFlatpak: BootstrapFlag = {
  key: 'no-flatpak',
  label: 'Skip Flatpak / GUI apps',
  flag: '--no-flatpak',
  help: 'Skip Flathub desktop apps — recommended on servers and under WSL.',
  kind: 'provision',
};

export const targets: BootstrapTarget[] = [
  {
    id: 'macos',
    label: 'macOS',
    repo: 'dotfiles-MacBook',
    dialect: 'sh',
    entry: './bootstrap.sh',
    cloneDir: '~/dotfiles-MacBook',
    modules: true,
    blurb: 'Apple Silicon or Intel. Homebrew does the heavy lifting; Core is vendored.',
    flags: [
      linksOnly,
      {
        key: 'no-brew',
        label: 'Skip Homebrew / brew bundle',
        flag: '--no-brew',
        help: 'Symlinks + mise only; leave Homebrew and the Brewfile alone.',
        kind: 'provision',
      },
      {
        key: 'macos-defaults',
        label: 'Apply macOS system defaults',
        flag: '--macos-defaults',
        help: 'Also run macos/defaults.sh (system prefs). May require a logout.',
        kind: 'provision',
      },
      {
        key: 'set-shell',
        label: 'Set zsh as the default shell',
        flag: '--set-shell',
        help: 'chsh to the Homebrew zsh after install.',
        kind: 'provision',
      },
      {
        key: 'dry-run',
        label: 'Dry run — preview, change nothing',
        flag: '--dry-run',
        help: 'Print every planned action and mutate nothing. Re-run without it to apply.',
        kind: 'safety',
      },
    ],
    notes: ['Open a fresh shell when it finishes: `exec zsh`.'],
  },
  {
    id: 'windows',
    label: 'Windows',
    repo: 'dotfiles-Windows',
    dialect: 'ps',
    entry: '.\\install.ps1',
    blurb: 'The native host layer. PowerShell 7 + Developer Mode (or run elevated) so symlinks work.',
    flags: [
      {
        key: 'skip-packages',
        label: 'Config only — skip package install',
        flag: '-SkipPackages',
        help: 'Re-wire the symlinks without scoop/winget/module installs.',
        kind: 'provision',
      },
      {
        key: 'dry-run',
        label: 'Dry run — preview, change nothing',
        flag: '-DryRun',
        help: 'Preview every change and mutate nothing.',
        kind: 'safety',
      },
    ],
    notes: [
      'Needs PowerShell 7 (`pwsh`) and Developer Mode or an elevated shell.',
      'WSL distros configure themselves from their own repos — this is the host only.',
    ],
  },
  {
    id: 'kali',
    label: 'Kali (WSL2)',
    repo: 'dotfiles-Kali',
    dialect: 'sh',
    entry: './bootstrap.sh',
    cloneDir: '~/dotfiles-Kali',
    modules: true,
    blurb: 'Three layers: Core + apt OS layer + the offensive role layer. Built for Kali on WSL2.',
    flags: [
      linksOnly,
      {
        key: 'no-offensive',
        label: 'Skip offensive tooling',
        flag: '--no-offensive',
        help: 'Install the apt base + symlinks only; skip the heavy offensive tool set.',
        kind: 'provision',
      },
    ],
    notes: [
      'WSL2 is NAT’d — enable mirrored networking on the Windows side (`%UserProfile%\\.wslconfig`) for a LAN-reachable listener, then `wsl.exe --shutdown`.',
      'Keep engagement data in ~/engagements, outside the repo.',
    ],
  },
  {
    id: 'fedora',
    label: 'Fedora',
    repo: 'dotfiles-Fedora',
    dialect: 'sh',
    entry: './bootstrap.sh',
    cloneDir: '~/dotfiles-Fedora',
    modules: true,
    blurb: 'The Linux template every other distro repo is stamped from. dnf + RPM Fusion.',
    flags: [linksOnly, noFlatpak],
    notes: ['Land in the new shell with `exec zsh`.'],
  },
  {
    id: 'arch',
    label: 'Arch',
    repo: 'dotfiles-Arch',
    dialect: 'sh',
    entry: './bootstrap.sh',
    cloneDir: '~/dotfiles-Arch',
    modules: true,
    blurb: 'Rolling-release Arch. pacman + AUR. A minimal box needs the stage-0 prep in SETUP.md first.',
    flags: [linksOnly, noFlatpak],
    notes: ['Bare-metal / minimal install? Do the stage-0 prep in SETUP.md (git, sudo, a UTF-8 locale) first.'],
  },
  {
    id: 'opensuse',
    label: 'openSUSE',
    repo: 'dotfiles-openSUSE',
    dialect: 'sh',
    entry: './bootstrap.sh',
    cloneDir: '~/dotfiles-openSUSE',
    modules: true,
    blurb: 'zypper with the best dependency solver of the bunch. Tumbleweed (dup) + Leap (up) aware.',
    flags: [linksOnly, noFlatpak],
    notes: ['Land in the new shell with `exec zsh`.'],
  },
  {
    id: 'alpine',
    label: 'Alpine',
    repo: 'dotfiles-Alpine',
    dialect: 'sh',
    entry: './bootstrap.sh',
    cloneDir: '~/dotfiles-Alpine',
    modules: true,
    blurb: 'The lean outlier: musl libc, busybox, doas. Run as root or with doas; enable the community repo.',
    flags: [linksOnly],
    notes: ['Run as root or with doas, and make sure the community apk repo is enabled.'],
  },
  {
    id: 'gentoo',
    label: 'Gentoo',
    repo: 'dotfiles-Gentoo',
    dialect: 'sh',
    entry: './bootstrap.sh',
    cloneDir: '~/dotfiles-Gentoo',
    modules: true,
    blurb: 'Source-based capstone. emerge compiles packages, so expect real build time.',
    flags: [
      linksOnly,
      {
        key: 'no-sync',
        label: 'Skip emerge --sync on re-runs',
        flag: '--no-sync',
        help: 'Skip the slow Portage tree sync when re-running.',
        kind: 'provision',
      },
    ],
    notes: ['First build compiles from source — expect it to take a while.'],
  },
];
