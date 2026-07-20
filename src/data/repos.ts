// The repo map for the showcase grid. `status` drives the badge + whether we link out.
//   stable  -> public + ready to use (links to GitHub)
//   beta    -> public but still settling
//   wip     -> being built right now
//   planned -> on the roadmap, not yet public
export type RepoStatus = 'stable' | 'beta' | 'wip' | 'planned';

export type Layer = 'core' | 'os' | 'role' | 'host';

// A "what actually bites" note for a repo's generated hub page — the deep detail the
// lean README defers here instead of carrying inline.
export interface RepoSpecific {
  label: string; // the short claim (bolded)
  detail: string; // the explanation
}

// A related deep-dive page elsewhere on this hub. `slug` is the docs id (no leading
// /docs), resolved through withBase(`/docs/${slug}`) in the template.
export interface RepoDoc {
  label: string;
  slug: string;
}

export interface Repo {
  name: string; // repo name (also the GitHub slug under the owner)
  layer: Layer;
  status: RepoStatus;
  blurb: string;
  highlights: string[];
  icon: string; // short glyph/emoji used on the card
  // Optional, render only on the generated per-repo hub page (src/pages/docs/repos/[repo].astro).
  install?: string; // getting-started snippet (raw, no code fence — the template adds it)
  installNote?: string; // one-line note under the snippet (flags, prereqs)
  specifics?: RepoSpecific[]; // the things that actually bite on this layer
  docs?: RepoDoc[]; // deep-dive pages to read next
}

// Live, source-derived numbers (per-repo package counts, Core metrics) are merged
// in at render time from src/data/generated.json — produced by
// scripts/collect-metrics.mjs reading the sibling repos. Keep prose here and keep
// counts out of this file so they can't drift from the actual repositories.

export const layerMeta: Record<Layer, { label: string; accent: string; desc: string }> = {
  core: {
    label: 'Core',
    accent: 'purple',
    desc: 'Authored once, vendored everywhere via git subtree.',
  },
  os: {
    label: 'OS-native',
    accent: 'blue',
    desc: 'Package manager, paths, clipboard — what changes with the OS.',
  },
  host: {
    label: 'Native host',
    accent: 'cyan',
    desc: 'The Windows host layer: pwsh, Terminal, the WSL bridge.',
  },
  role: {
    label: 'Role',
    accent: 'red',
    desc: 'Operator role — offensive or defensive — stacked on top of an OS layer.',
  },
};

export const statusMeta: Record<RepoStatus, { label: string; tone: string }> = {
  stable: { label: 'Stable', tone: 'green' },
  beta: { label: 'Beta', tone: 'cyan' },
  wip: { label: 'In progress', tone: 'orange' },
  planned: { label: 'Planned', tone: 'muted' },
};

export const repos: Repo[] = [
  {
    name: 'dotfiles-core',
    layer: 'core',
    status: 'stable',
    icon: '◆',
    blurb:
      'The keystone. Single source of truth for everything identical on every machine — shell modules, tmux base, Neovim, git, starship, mise.',
    highlights: ['zsh module chain', 'lazy.nvim tree', 'tmux + starship + mise', 'audited & benchmarked'],
    installNote:
      'Core is never installed directly — clone the repo for your platform (macOS, Kali, Fedora, …), which already carries Core vendored inside it.',
    specifics: [
      {
        label: 'Load order is load-bearing',
        detail:
          'The zsh chain is tools → ui → options → history → aliases → git → functions → fzf → bindings → plugins → op → maint → update → os → local. Reordering it breaks detection and completion.',
      },
      {
        label: 'Modern-CLI swaps are guarded',
        detail:
          '00-tools.zsh resolves HAVE_* flags at load time, so every alias (eza/bat/zoxide/…) falls back to the classic command on a box that lacks the newer one. Nothing breaks; it just gets nicer where it can.',
      },
      {
        label: 'One gate defines healthy',
        detail:
          'scripts/audit-core.sh (make audit) checks manifest drift, exec-bits, syntax, shellcheck, luacheck, markdownlint, and a behavioral suite. A red tree must never be vendored out.',
      },
      {
        label: 'A change here fans out N-way',
        detail:
          'Core is vendored into every OS repo via git subtree, so a defect fixed once lands everywhere on the next make sync. Treat every change as if it ships to all of them — because it does.',
      },
    ],
    docs: [
      { label: 'The audit gate', slug: 'reference/the-audit-gate' },
      { label: 'Alias reference', slug: 'reference/aliases' },
      { label: 'Porting matrix', slug: 'reference/porting-matrix' },
      { label: 'Security policy', slug: 'reference/security-policy' },
    ],
  },
  {
    name: 'dotfiles-MacBook',
    layer: 'os',
    status: 'stable',
    icon: '⌘',
    blurb:
      'macOS (Apple Silicon / Intel) terminal environment. Homebrew + brew bundle, Ghostty, 1Password agent, native pbcopy clipboard — plus a committed tiling-desktop layer: AeroSpace, SketchyBar, and Karabiner.',
    highlights: ['Homebrew + Brewfile', 'Ghostty + 1Password', 'AeroSpace · SketchyBar · Karabiner', 'macOS defaults'],
    install: `git clone https://github.com/dotgibson/dotfiles-MacBook ~/dotfiles-MacBook
cd ~/dotfiles-MacBook
./bootstrap.sh --links-only --dry-run   # preview the symlink plan
./bootstrap.sh                          # Homebrew + brew bundle + symlinks
exec zsh
./bootstrap.sh --macos-defaults         # optional: apply system prefs`,
    installNote:
      'Core is already vendored in a clone. Flags: --dry-run/-n, --links-only, --no-brew, --set-shell, --macos-defaults.',
    specifics: [
      {
        label: 'Homebrew on either arch',
        detail:
          'Lives at /opt/homebrew (Apple Silicon) or /usr/local (Intel); .zprofile handles both. Packages live in the committed Brewfile (brew bundle), not install/packages.txt.',
      },
      {
        label: 'Native clipboard + keychain',
        detail:
          "Core's clip/clip-paste shell out to pbcopy/pbpaste; git credentials use the macOS keychain via osxkeychain.",
      },
      {
        label: '1Password SSH agent',
        detail:
          '.zprofile points SSH_AUTH_SOCK at the 1Password socket — comment it out if you do not use it.',
      },
      {
        label: 'A committed desktop layer',
        detail:
          'Beyond the terminal: AeroSpace (tiling WM), SketchyBar (menu bar, tokyonight-storm), and Karabiner (caps→ctrl/esc + a hyper layer) all live here and are themed to match Core.',
      },
    ],
    docs: [{ label: 'Migrating macOS onto the system', slug: 'guides/migrating-macos' }],
  },
  {
    name: 'dotfiles-Windows',
    layer: 'host',
    status: 'stable',
    icon: '⊞',
    blurb:
      'The native Windows host: PowerShell 7 as daily driver, Windows Terminal, scoop/winget, psmux, and the bridge into WSL2.',
    highlights: ['pwsh profile loader', 'scoop + winget', 'psmux multiplexer', 'WSL2 bridge'],
    install: `irm https://raw.githubusercontent.com/dotgibson/dotfiles-Windows/main/bootstrap.ps1 | iex

# or clone + install manually:
git clone https://github.com/dotgibson/dotfiles-Windows.git
cd dotfiles-Windows
.\\install.ps1            # packages + symlinks (-SkipPackages, -DryRun, -Help)`,
    installNote:
      'Requires PowerShell 7 (pwsh) and Developer Mode (or run elevated) so symlinks work. The bootstrap one-liner is integrity-gated — verify its pinned SHA-256 before piping to iex.',
    specifics: [
      {
        label: 'No vendored core/ here',
        detail:
          'Unlike every OS repo, Windows does NOT vendor Core as a git subtree — host config is replicated natively in PowerShell. Only nvim/ and starship.toml are mirrored from Core (via nvim-sync.ps1 / starship-sync.ps1).',
      },
      {
        label: 'A pwsh loader that mirrors the zsh one',
        detail:
          'profile.ps1 dot-sources core/ → os/ → local.ps1 in name order, so dropping a core/NN-name.ps1 or os/NN-name.ps1 in is all it takes — same feel as the zsh loader everywhere else.',
      },
      {
        label: 'No offensive layer — it bridges to one',
        detail:
          'This is a host/productivity repo only; the offensive role lives on the Kali station inside WSL. kali / cdwsl bridge you there from the host shell.',
      },
      {
        label: 'Supply-chain-gated bootstrap',
        detail:
          "bootstrap.ps1 clones over git (pin DOTFILES_REF for an exact checkout) and never pipes a further network script into iex; scoop's installer stays behind the DOTFILES_SCOOP_SHA256 gate.",
      },
    ],
    docs: [{ label: 'Windows architecture audit', slug: 'reference/windows-architecture-audit' }],
  },
  {
    name: 'dotfiles-Kali',
    layer: 'role',
    status: 'stable',
    icon: '⚔',
    blurb:
      'The Kali node — Core + apt OS layer + a unique offensive role layer for authorized engagements.',
    highlights: ['engagement scaffolding', 'scope-first workflow', 'NetExec / BloodHound CE', 'WSL2 mirrored net'],
    install: `git clone https://github.com/dotgibson/dotfiles-Kali ~/dotfiles-Kali
cd ~/dotfiles-Kali
./bootstrap.sh                 # apt base + offensive tools + symlinks
wsl.exe --shutdown             # from Windows, after dropping windows.wslconfig.example`,
    installNote:
      'Built for Kali on WSL2. Flags: --no-offensive (skip the heavy tool install), --links-only.',
    specifics: [
      {
        label: 'Three layers, not two',
        detail:
          'Kali adds an offensive stage to the zsh loader (… os offensive local), slotted after os so paths/clipboard resolve first and before local so a machine override still wins. It is Debian-family (apt) and its own lineage — not stamped from Fedora.',
      },
      {
        label: 'Engagement data never lives in the repo',
        detail:
          'Everything goes under ~/engagements (outside any git tree); the paranoid .gitignore is only a backstop. mkengagement writes scope/scope.txt first — installing a tool is not permission to point it at anything.',
      },
      {
        label: 'The naming changes that bite',
        detail:
          'CrackMapExec is gone — it is nxc (NetExec) now, the single highest-leverage tool in the kit. BloodHound is Community Edition; the bhce helper drives nxc’s --bloodhound module for a CE-ready collection.',
      },
      {
        label: 'WSL2 is NAT’d',
        detail:
          'A listener / reverse shell / C2 in Kali is not LAN-reachable until you set networkingMode=mirrored in the Windows-side %UserProfile%\\.wslconfig (Win11 22H2+) — not /etc/wsl.conf.',
      },
    ],
    docs: [{ label: 'Offensive methodology', slug: 'reference/offensive-methodology' }],
  },
  {
    name: 'dotfiles-Defense',
    layer: 'role',
    status: 'stable',
    icon: '⛨',
    blurb:
      'The blue mirror of Kali — the defensive role. Detection engineering & investigation: hunt/triage tooling, version-controlled detection content (Sigma, Sysmon, Zeek/Suricata, SIEM), and a Dockerized detection lab. Distro-agnostic.',
    highlights: ['Sigma / Sysmon / Zeek', 'mkcase hunt workflow', 'Dockerized detection lab', 'distro-agnostic + Core'],
    install: `git clone https://github.com/dotgibson/dotfiles-Defense ~/dotfiles-Defense
cd ~/dotfiles-Defense
./bootstrap.sh                 # symlinks Core + defense; checks docker
exec zsh`,
    installNote:
      'Distro-agnostic: host tools come from your OS-native layer; the heavy detection stack comes up in containers via docker/ (siemup / siemdown).',
    specifics: [
      {
        label: 'A defense stage on the loader',
        detail:
          'Adds one stage just before local overrides (… os defense local). defense/defense.zsh holds workflow helpers only (mkcase, gocase, note, siemup/siemdown), all HAVE_*-guarded.',
      },
      {
        label: 'Case data never lives in the repo',
        detail:
          'Investigation data lives under ~/cases (outside the repo), exactly like Kali keeps engagements in ~/engagements. mkcase scaffolds a case outside the repo by design; the .gitignore is a backstop.',
      },
      {
        label: 'No blue-team distro required',
        detail:
          'The blue stack is overwhelmingly containers, so this repo assumes no specific OS — you do not need Security Onion or a dedicated distro. Version-controlled detection content (Sigma/Sysmon/network/SIEM) lives under detections/.',
      },
      {
        label: 'Red vs blue is a split, not a merge',
        detail:
          "Attacker-authored detections stay in Kali's PURPLE-TEAM.md; defender-authored capability lives here. The two cross-link rather than copy.",
      },
    ],
    docs: [{ label: 'Offensive methodology (the red mirror)', slug: 'reference/offensive-methodology' }],
  },
  {
    name: 'dotfiles-Fedora',
    layer: 'os',
    status: 'stable',
    icon: '◉',
    blurb: 'The Linux template every other distro repo is stamped from. dnf + RPM Fusion, Flathub, Wayland clipboard, SELinux helpers.',
    highlights: ['dnf package layer', 'distro template', 'Wayland/X11 clip', 'SELinux helpers'],
    install: `git clone https://github.com/dotgibson/dotfiles-Fedora ~/dotfiles-Fedora
cd ~/dotfiles-Fedora
./bootstrap.sh
exec zsh`,
    installNote: 'Core is already vendored in a clone. Flags: --links-only (re-link only), --no-flatpak.',
    specifics: [
      {
        label: 'The template the others stamp from',
        detail:
          'OS-native structure changes start here, then propagate to Arch/openSUSE/Alpine/Gentoo per the porting matrix — swap the package manager and clipboard backend, keep the structure.',
      },
      {
        label: 'dnf5 + RPM Fusion',
        detail:
          'dnf5 is the default engine since Fedora 41 (the dnf command is unchanged); dnf-undo rolls back the last transaction. RPM Fusion (free + nonfree) is enabled for codecs.',
      },
      {
        label: 'Wayland-first clipboard',
        detail:
          'wl-copy/wl-paste, shimmed to pbcopy/pbpaste so Mac muscle memory carries over; X11 xclip fallback for SSH.',
      },
      {
        label: 'SELinux is enforcing',
        detail:
          'se-restore, se-denials, and se-why helpers ship in os/fedora.zsh — worth knowing, since SELinux context issues are a common troubleshooting surface.',
      },
    ],
    docs: [{ label: 'Porting matrix', slug: 'reference/porting-matrix' }],
  },
  {
    name: 'dotfiles-Arch',
    layer: 'os',
    status: 'stable',
    icon: '▲',
    blurb: 'Rolling-release Arch. pacman + AUR + multilib, with a bare-metal stage-0 SETUP guide for a minimal install.',
    highlights: ['pacman + AUR', 'multilib + mirrors', 'stage-0 SETUP.md', 'rolling release'],
    install: `git clone https://github.com/dotgibson/dotfiles-Arch ~/dotfiles-Arch
cd ~/dotfiles-Arch
./bootstrap.sh
exec zsh`,
    installNote:
      'A fresh/minimal Arch box needs stage-0 groundwork first (user, sudo, git, UTF-8 locale) — see the Arch stage-0 setup guide. Flags: --links-only, --no-flatpak.',
    specifics: [
      {
        label: 'Never partial-upgrade',
        detail:
          'pacman -Sy <pkg> without -u can pull a package built against newer libraries than your un-upgraded system and break things. bootstrap always does a full -Syu; the shell layer exposes only pacu (full -Syu), never a -Sy <pkg> alias.',
      },
      {
        label: 'Everything is in the official repos',
        detail:
          'eza/bat/fd/… plus starship, atuin, yazi, mise, and lazygit all live in core/extra — Fedora installs the last five from upstream; Arch just pacman -S’s them. The cleanest distro for this stack.',
      },
      {
        label: 'The AUR is not automated',
        detail:
          'Arch ships no AUR helper. Build paru once and the aur/aurs/auru aliases in os/arch.zsh light up. multilib (32-bit / Wine) is opt-in — uncomment [multilib] in pacman.conf yourself.',
      },
      {
        label: 'No transaction undo',
        detail:
          'pacman has no dnf history undo; recover by reinstalling an older build from the cache — pacdowngrade <pkg> lists cached versions, then pacman -U.',
      },
    ],
    docs: [
      { label: 'Arch stage-0 setup', slug: 'guides/arch-setup' },
      { label: 'Porting matrix', slug: 'reference/porting-matrix' },
    ],
  },
  {
    name: 'dotfiles-openSUSE',
    layer: 'os',
    status: 'stable',
    icon: '❖',
    blurb: 'zypper with the best dependency solver of the bunch. Packman, AppArmor, Btrfs/snapper, Tumbleweed (dup) + Leap (up) aware.',
    highlights: ['zypper + Packman', 'Btrfs / snapper', 'AppArmor', 'Tumbleweed + Leap'],
    install: `git clone https://github.com/dotgibson/dotfiles-openSUSE ~/dotfiles-openSUSE
cd ~/dotfiles-openSUSE
./bootstrap.sh
exec zsh`,
    installNote: 'Core is already vendored in a clone. Flags: --links-only, --no-flatpak.',
    specifics: [
      {
        label: 'Two flavors, different update command',
        detail:
          'Tumbleweed (rolling) upgrades with zypper dup (zdup); Leap (stable) uses zypper up (zup). Get it wrong and you either do not update or you half-update. bootstrap only refreshes metadata — the choice stays yours.',
      },
      {
        label: 'The best solver of the set',
        detail:
          'Lean on it. On a Tumbleweed dup, vendor-change / package-split prompts are normal — read them, do not reflexively decline.',
      },
      {
        label: 'AppArmor + Btrfs rollback',
        detail:
          'AppArmor (aa-status/aa-complain/aa-enforce) is the default MAC, not SELinux. Rollback is Btrfs + snapper (snaps, snapper undochange) snapshotted around each transaction — not package history.',
      },
      {
        label: 'Packman for codecs',
        detail:
          "openSUSE's analog to RPM Fusion. Not auto-added (the URL differs Tumbleweed-vs-Leap and it is not needed for the CLI stack); add it manually if you want codecs.",
      },
    ],
    docs: [{ label: 'Porting matrix', slug: 'reference/porting-matrix' }],
  },
  {
    name: 'dotfiles-Alpine',
    layer: 'os',
    status: 'stable',
    icon: '❄',
    blurb: 'The lean outlier: musl libc, busybox, doas. The small-footprint / container / rescue layer — bootstrap detects doas vs sudo.',
    highlights: ['musl + busybox', 'apk + doas', 'container / rescue'],
    install: `git clone https://github.com/dotgibson/dotfiles-Alpine ~/dotfiles-Alpine
cd ~/dotfiles-Alpine
./bootstrap.sh
exec zsh`,
    installNote:
      'Run as root, or as a user with doas (or sudo) configured — bootstrap detects which. Make sure the community repo is enabled in /etc/apk/repositories. Flag: --links-only.',
    specifics: [
      {
        label: 'musl libc, not glibc',
        detail:
          'Prebuilt glibc binaries will not run, so the stack comes from apk wherever possible. starship/mise install via scripts that detect musl; yazi and tree-sitter-cli are compiled with cargo (why build-base is in the package list).',
      },
      {
        label: 'doas, not sudo',
        detail:
          'bootstrap auto-detects doas → sudo → root; the shell layer aliases sudo→doas so muscle memory works. Configure /etc/doas.d/doas.conf or run as root.',
      },
      {
        label: 'ash is the default shell',
        detail:
          'zsh is installed explicitly and the login shell is switched with chsh (from the shadow package — busybox has none). bootstrap reads the current shell from /etc/passwd directly because busybox has no getent.',
      },
      {
        label: 'No MAC framework, no flatpak',
        detail:
          "Alpine ships no default SELinux/AppArmor and flatpak isn't idiomatic, so those Fedora/openSUSE helper blocks are removed entirely — keeping the lean/container/rescue layer small.",
      },
    ],
    docs: [{ label: 'Porting matrix', slug: 'reference/porting-matrix' }],
  },
  {
    name: 'dotfiles-Gentoo',
    layer: 'os',
    status: 'stable',
    icon: '◢',
    blurb: 'Source-based capstone. emerge + full category/name atoms + USE flags — the most educational build in the fleet.',
    highlights: ['emerge from source', 'USE flags', 'full atoms', '--no-sync re-runs'],
    install: `git clone https://github.com/dotgibson/dotfiles-Gentoo ~/dotfiles-Gentoo
cd ~/dotfiles-Gentoo
./bootstrap.sh
exec zsh`,
    installNote:
      'Run as root or with sudo/doas configured. Flags: --no-sync (skip the slow emerge --sync on re-runs), --links-only.',
    specifics: [
      {
        label: 'It compiles — so cut build time two ways',
        detail:
          'The official binhost (bootstrap auto-adds --getbinpkg when binrepos.conf is configured) installs prebuilt binpkgs instead of compiling, and dev-lang/rust-bin gives you a prebuilt Rust so you skip a multi-hour toolchain compile.',
      },
      {
        label: 'USE flags are the whole point',
        detail:
          'They gate features at compile time — inspect with equery uses / emerge -pv, apply with emerge -auvDN --newuse @world. See gentoo/package.use.example for the mechanism.',
      },
      {
        label: 'Keyword masking',
        detail:
          "On a stable profile, fast-moving Rust CLIs may be ~amd64 only and emerge refuses them; bootstrap's resilient loop skips a blocked atom and tells you. Unmask via gentoo/package.accept_keywords.example. Atoms are full category/name.",
      },
      {
        label: 'Living with Portage',
        detail:
          'After a world update Portage often wants @preserved-rebuild and dispatch-conf; actually read eselect news (gnews) — that is how breaking changes are announced.',
      },
    ],
    docs: [{ label: 'Porting matrix', slug: 'reference/porting-matrix' }],
  },
];
