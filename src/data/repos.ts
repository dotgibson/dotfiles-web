// The repo map for the showcase grid. `status` drives the badge + whether we link out.
//   stable  -> public + ready to use (links to GitHub)
//   beta    -> public but still settling
//   wip     -> being built right now
//   planned -> on the roadmap, not yet public
export type RepoStatus = 'stable' | 'beta' | 'wip' | 'planned';

export type Layer = 'core' | 'os' | 'role' | 'host';

export interface Repo {
  name: string; // repo name (also the GitHub slug under the owner)
  layer: Layer;
  status: RepoStatus;
  blurb: string;
  highlights: string[];
  icon: string; // short glyph/emoji used on the card
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
    label: 'Role / offensive',
    accent: 'red',
    desc: 'Engagement scaffolding stacked on top of an OS layer.',
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
  },
  {
    name: 'dotfiles-MacBook',
    layer: 'os',
    status: 'stable',
    icon: '⌘',
    blurb:
      'macOS (Apple Silicon / Intel) terminal environment. Homebrew + brew bundle, Ghostty, 1Password agent, native pbcopy clipboard.',
    highlights: ['Homebrew + Brewfile', 'Ghostty config', 'osxkeychain git', 'macOS defaults'],
  },
  {
    name: 'dotfiles-Windows',
    layer: 'host',
    status: 'stable',
    icon: '⊞',
    blurb:
      'The native Windows host: PowerShell 7 as daily driver, Windows Terminal, scoop/winget, psmux, and the bridge into WSL2.',
    highlights: ['pwsh profile loader', 'scoop + winget', 'psmux multiplexer', 'WSL2 bridge'],
  },
  {
    name: 'dotfiles-Kali',
    layer: 'role',
    status: 'stable',
    icon: '⚔',
    blurb:
      'The Kali node — the only repo with three layers. Core + apt OS layer + a unique offensive role layer for authorized engagements.',
    highlights: ['engagement scaffolding', 'scope-first workflow', 'NetExec / BloodHound CE', 'WSL2 mirrored net'],
  },
  {
    name: 'dotfiles-Fedora',
    layer: 'os',
    status: 'stable',
    icon: '◉',
    blurb: 'The Linux template every other distro repo is stamped from. dnf + RPM Fusion, Flathub, Wayland clipboard, SELinux helpers.',
    highlights: ['dnf package layer', 'distro template', 'Wayland/X11 clip', 'SELinux helpers'],
  },
  {
    name: 'dotfiles-Arch',
    layer: 'os',
    status: 'beta',
    icon: '▲',
    blurb: 'Rolling-release Arch. pacman + AUR + multilib, with a bare-metal stage-0 SETUP guide for a minimal install.',
    highlights: ['pacman + AUR', 'multilib + mirrors', 'stage-0 SETUP.md', 'rolling release'],
  },
  {
    name: 'dotfiles-openSUSE',
    layer: 'os',
    status: 'beta',
    icon: '❖',
    blurb: 'zypper with the best dependency solver of the bunch. Packman, AppArmor, Btrfs/snapper, Tumbleweed (dup) + Leap (up) aware.',
    highlights: ['zypper + Packman', 'Btrfs / snapper', 'AppArmor', 'Tumbleweed + Leap'],
  },
  {
    name: 'dotfiles-Alpine',
    layer: 'os',
    status: 'beta',
    icon: '❄',
    blurb: 'The lean outlier: musl libc, busybox, doas. The small-footprint / container / rescue layer — bootstrap detects doas vs sudo.',
    highlights: ['musl + busybox', 'apk + doas', 'container / rescue'],
  },
  {
    name: 'dotfiles-Gentoo',
    layer: 'os',
    status: 'beta',
    icon: '◢',
    blurb: 'Source-based capstone. emerge + full category/name atoms + USE flags — the most educational build in the fleet.',
    highlights: ['emerge from source', 'USE flags', 'full atoms', '--no-sync re-runs'],
  },
];
