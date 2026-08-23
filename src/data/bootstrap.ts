// Data model for the Bootstrap Command Generator (Track A — see
// docs/interactive-features-design.md §1). The page renders ENTIRELY from this
// list: a target is a platform/repo with a curated set of flags its real bootstrap
// accepts. Adding a platform or flag is a data edit here, nothing else.
//
// THE CONTRACT (design doc §0 verification tier): every `flag` token below must
// be one the repo's bootstrap actually parses. Unknown flags hard-fail on macOS
// (its bootstrap validates against a KNOWN_FLAGS allowlist) and are wrong
// everywhere else, so a target only ever lists flags it genuinely supports.
//
// What this file records is the CURATED set each target SURFACES — deliberately NOT the
// complete set its repo accepts. The generator omits automation and destructive flags
// (--uninstall, --json, --quiet, --strict, -Yes, …), and several repos take more than is
// listed here: Fedora's --force-os, openSUSE's --tolerate-failures, Gentoo's --no-extras
// / --no-portage-config / --user, and the -n alias for --dry-run on all but Gentoo,
// openSUSE and Defense.
//
// So do NOT read a target's `flags` as "everything this bootstrap accepts". This header
// used to carry a per-repo inventory that was read exactly that way, and it went stale:
// the Linux targets withheld a --dry-run that every one of them has long supported,
// behind a comment asserting they would reject it. Ask the repo, not this file —
// `npm run verify:flags` prints each repo's real accepted set.
//
// Every repo that vendors core/lib/bootstrap-lib.sh accepts --only/--skip module
// selection (Track B); `modules: true` opts a target into the UI. Windows has no
// vendored Core, so it carries no module groups, and dotfiles-Defense parses only the
// `--only=`/`--skip=` equals form — see the note on its target below.
// Re-verify after any bootstrap change — scripts/verify-bootstrap-flags.mjs guards it,
// and CI runs it in data-freshness.yml's derived-data job.

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
  id: string; // 'macos', 'debian', 'offense', ...  (OS-native layers and role layers)
  label: string; // tab label
  repo: string; // repo slug under dotgibson
  dialect: Dialect; // drives clone form, prompt glyph, and flag syntax
  entry: string; // './bootstrap.sh' | '.\\install.ps1'
  cloneDir?: string; // sh only; defaults to ~/<repo> when unset
  blurb: string; // one line shown above the options
  flags: BootstrapFlag[]; // the curated flags THIS target surfaces (all genuinely accepted)
  modules?: boolean; // does this bootstrap accept --only/--skip module selection?
  // Module groups THIS layer adds on top of Core's shared six. A layer may extend
  // BLIB_MODULES with groups of its own (macOS does — see below), and those are only
  // valid for that target, so they hang off the target rather than the global list.
  extraModuleGroups?: ModuleGroup[];
  notes?: string[]; // post-install reminders rendered below the command
}

// The Core wiring groups a `modules: true` target can narrow with --only/--skip
// (the shared core/lib/bootstrap-lib.sh scaffold — see dotfiles-core). All six are
// linked by default; the generator emits --only/--skip ONLY when a subset is chosen.
//
// The keys MUST match the target's EFFECTIVE BLIB_MODULES — which is Core's shared six
// plus anything that target's own bootstrap appends before it validates a selector. This
// list is only the shared six; a layer's own groups live in its `extraModuleGroups`, and
// the generator concatenates the two. (Core's BLIB_MODULES is "zsh nvim tmux git prompt
// tools"; dotfiles-MacBook appends `desktop` at bootstrap.sh:207.)
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
const noUpgrade: BootstrapFlag = {
  key: 'no-upgrade',
  label: 'Skip the full-upgrade',
  flag: '--no-upgrade',
  help: 'Still run apt-get update, but skip full-upgrade — useful when you want the tools without moving the whole system.',
  kind: 'provision',
};
const noUnattended: BootstrapFlag = {
  key: 'no-unattended',
  label: "Don't configure unattended-upgrades",
  flag: '--no-unattended',
  help: 'Skip enabling automatic security-pocket updates. Bootstrap otherwise turns them on, because these boxes are unattended by definition.',
  kind: 'provision',
};
const forceOs: BootstrapFlag = {
  key: 'force-os',
  label: 'Allow a Debian-like derivative',
  flag: '--force-os',
  help: 'The bootstrap refuses to run unless /etc/os-release reports ID=ubuntu, ID=debian or ID=kali. Other derivatives (Mint, Pop!_OS, Raspbian) report ID_LIKE=debian and need this to proceed — their package sets are close but not CI-proven.',
  kind: 'provision',
};
// Every sh target accepts --dry-run. Alpine is the one exception to this wording — its
// dry run also forces --links-only — so it carries its own copy rather than sharing this.
const dryRun: BootstrapFlag = {
  key: 'dry-run',
  label: 'Dry run — preview, change nothing',
  flag: '--dry-run',
  help: 'Print every planned action and mutate nothing. Re-run without it to apply.',
  kind: 'safety',
};
// Shared by the two role layers, which both probe the host and report rather than install.
const noCheck: BootstrapFlag = {
  key: 'no-check',
  label: 'Skip the host-tool report',
  flag: '--no-check',
  help: 'Skip the probe that reports which tools are present, installed but unreachable, or missing. The probe only ever reports — it never installs.',
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
      dryRun,
    ],
    // macOS is the only layer that extends Core's BLIB_MODULES — bootstrap.sh:207 appends
    // `desktop` before validating a selector, so --only/--skip accept it there and nowhere
    // else. Without this the generator silently wired six configs the operator had unticked.
    extraModuleGroups: [
      {
        key: 'desktop',
        label: 'Desktop apps',
        help: 'the macOS-only desktop configs: ghostty, fastfetch, aerospace, sketchybar and karabiner',
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
    // A ROLE layer, not an OS one: it stacks on whatever OS-native layer the box
    // already runs (the `debian` target covers Kali). It installs NOTHING by default —
    // the default run wires symlinks and reports which offensive tools are present.
    id: 'offense',
    label: 'Offense (role layer)',
    repo: 'dotfiles-Offense',
    dialect: 'sh',
    entry: './bootstrap.sh',
    cloneDir: '~/dotfiles-Offense',
    modules: true,
    blurb:
      'The offensive role layer, stacked on an OS-native layer you install first — the Debian / Ubuntu target covers a Kali box. Distro-agnostic, and it installs nothing unless you ask.',
    flags: [
      linksOnly,
      {
        key: 'install',
        label: 'Also install the offensive tool stack',
        flag: '--install',
        help: 'Opt in to the tool install. On Kali that is apt from install/offensive-packages.txt; on any other Debian-family box it is a smaller portable subset via pipx and go.',
        kind: 'provision',
      },
      noCheck,
      dryRun,
    ],
    notes: [
      'Install an OS-native layer FIRST — this repo owns no package manager, clipboard or paths.',
      'Keep engagement data in ~/engagements, outside the repo.',
      'Running Kali under WSL2? Enable mirrored networking on the Windows side (`%UserProfile%\\.wslconfig`) for a LAN-reachable listener, then `wsl.exe --shutdown`. That config lives in dotfiles-Debian.',
    ],
  },
  {
    // The BLUE mirror of `offense`, and a ROLE layer on the same terms: it stacks on
    // whatever OS-native layer the box runs and installs nothing. Genuinely
    // distro-agnostic — the detection stack is containers, so no blue-team distro.
    //
    // NO `modules: true`, and that is deliberate. dotfiles-Defense/bootstrap.sh parses
    // args with `for a in "$@"; do case "$a" in`, so it accepts --only/--skip ONLY in the
    // `--only=zsh,git` equals form. The generator emits the space-separated form
    // (generator.astro's moduleClause), which Defense's `*)` arm would reject with
    // `exit 1` — a broken copy-paste command. Opting out is the honest fix here; making
    // the generator emit `=` per target would be the alternative if this ever matters.
    // scripts/verify-bootstrap-flags.mjs asserts --only/--skip acceptance for any
    // `modules: true` target, so it would catch a regression on this.
    id: 'defense',
    label: 'Defense (role layer)',
    repo: 'dotfiles-Defense',
    dialect: 'sh',
    entry: './bootstrap.sh',
    cloneDir: '~/dotfiles-Defense',
    blurb:
      'The defensive role layer — detection engineering and investigation, stacked on an OS-native layer you install first. Distro-agnostic: the heavy stack runs in containers, so no dedicated blue-team distro.',
    flags: [linksOnly, noCheck, dryRun],
    notes: [
      'Install an OS-native layer FIRST — this repo owns no package manager, clipboard or paths.',
      'The detection lab needs Docker. Bring it up with `siemup` and down with `siemdown`.',
      'Keep case data in ~/cases, outside the repo — `mkcase` scaffolds it there by design.',
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
    flags: [linksOnly, noFlatpak, dryRun],
    notes: ['Land in the new shell with `exec zsh`.'],
  },
  {
    id: 'debian',
    label: 'Debian / Ubuntu',
    repo: 'dotfiles-Debian',
    dialect: 'sh',
    entry: './bootstrap.sh',
    cloneDir: '~/dotfiles-Debian',
    modules: true,
    blurb:
      'apt, covering Ubuntu 24.04 LTS, Debian trixie and Kali rolling. Ubuntu is the only frozen release in the fleet — so on it most of the stack arrives as pinned, checksum-verified upstream assets; Kali has nearly all of it in apt.',
    flags: [linksOnly, noUpgrade, noUnattended, forceOs, dryRun],
    notes: [
      'Land in the new shell with `exec zsh`.',
      'Ubuntu 24.04 LTS is the primary target; Debian trixie and Kali rolling are also proven in CI.',
      'On Kali, add the Offense role layer afterwards for the engagement tooling.',
    ],
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
    flags: [linksOnly, noFlatpak, dryRun],
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
    flags: [linksOnly, noFlatpak, dryRun],
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
    flags: [
      linksOnly,
      {
        key: 'dry-run',
        label: 'Dry run — preview, change nothing',
        flag: '--dry-run',
        help: 'Print every planned action and mutate nothing. On Alpine this also implies --links-only, because provisioning installs packages and touches the system.',
        kind: 'safety',
      },
    ],
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
      dryRun,
    ],
    notes: ['First build compiles from source — expect it to take a while.'],
  },
];
