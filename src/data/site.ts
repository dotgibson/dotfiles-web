// Central site metadata. Edit these and the whole site updates.
export const site = {
  name: 'dotfiles',
  title: 'dotfiles — a nine-repo terminal ecosystem',
  description:
    'A portable, layered dotfiles ecosystem: one vendored Core (zsh, tmux, Neovim, git, starship, mise) shared across every machine, OS-native layers per platform, and an offensive role layer for Kali. Clone-and-go, fully reproducible.',
  owner: 'Gerrrt',
  githubUser: 'Gerrrt',
  githubBase: 'https://github.com/Gerrrt',
  // The ecosystem's canonical hub repo. The global "GitHub" link (header/footer)
  // points here so visitors land on Core, not the user profile.
  coreRepo: 'dotfiles-core',
  tagline: 'One Core. Every machine. Clone-and-go.',
} as const;

// Convenience: full URL to the core repo, used by the top-level GitHub links.
export const coreRepoUrl = `${site.githubBase}/${site.coreRepo}`;

// Primary navigation. `href` values are page paths (base path is applied in the layout).
export const nav = [
  { label: 'Home', href: '/' },
  { label: 'Get Started', href: '/getting-started' },
  { label: 'Architecture', href: '/architecture' },
  { label: 'Repos', href: '/#repos' },
  { label: 'Changelog', href: '/changelog' },
] as const;
