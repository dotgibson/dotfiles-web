// Central site metadata. Edit these and the whole site updates.
export const site = {
  name: "dotfiles",
  title: "dotfiles — a nine-repo terminal ecosystem",
  description:
    "A portable, layered dotfiles ecosystem: one vendored Core (zsh, tmux, Neovim, git, starship, mise) shared across every machine, OS-native layers per platform, and an offensive role layer for Kali. Clone-and-go, fully reproducible.",
  owner: "Gerrrt",
  githubUser: "Gerrrt",
  githubBase: "https://github.com/Gerrrt",
  // The ecosystem's canonical hub repo. The global "GitHub" link (header/footer)
  // points here so visitors land on Core, not the user profile.
  coreRepo: "dotfiles-core",
  tagline: "One Core. Every machine. Clone-and-go.",
} as const;

// Convenience: full URL to the core repo, used by the top-level GitHub links.
export const coreRepoUrl = `${site.githubBase}/${site.coreRepo}`;

// A git ref we're willing to drop into a copy/pastable clone command. Deliberately
// strict — tag/branch characters only (letters, digits, . _ / -), no whitespace or
// shell metacharacters — so an operator typo in `release.channels` can't generate a
// broken or unsafe command line. Mirrored verbatim by the client-side rewrite on the
// Get Started page.
const REF_PATTERN = /^[A-Za-z0-9._/-]+$/;
export function isValidRef(channel: string): boolean {
  return REF_PATTERN.test(channel);
}

// Release channels surfaced by the docs version-switcher (Get Started page).
// This is the OPERATOR-maintained source of truth, bumped by hand at release
// time alongside `scripts/release.sh` in dotfiles-core — the docs deliberately
// do NOT hit the GitHub API at build time, so every published install command is
// deterministic and an older rebuild can't silently change which versions it
// offers.
//
//   • 'main' is always the rolling channel — clones track the default branch,
//     so no `--branch` flag is emitted.
//   • Each tag (e.g. 'v1.0.0') pins a hermetic release: because Core is vendored
//     via `git subtree --squash`, a tagged OS-repo clone carries the exact Core
//     it was tested with, so the same three-command install works for ANY tag.
//
// When you cut the first release: set `current` to the new tag and prepend it to
// `channels` (newest first). Until then both stay at 'main' (unreleased) and the
// switcher renders a static "rolling" pill instead of a dropdown.
export const release = {
  current: "v1.2.0",
  channels: ["v1.2.0", "v1.1.0", "v1.0.0", "main"] as readonly string[],
} as const;

// Fail the build LOUDLY on a malformed channel, at import time — not lazily when a
// visitor happens to select it. 'main' is the sentinel rolling channel; every other
// entry must be a clean git ref.
for (const c of [release.current, ...release.channels]) {
  if (c !== "main" && !isValidRef(c)) {
    throw new Error(
      `src/data/site.ts: release channel "${c}" is not a valid git ref ` +
        `(allowed: letters, digits, and . _ / -). Fix release.current/release.channels.`,
    );
  }
}

// The clone-ref flag for a channel: '' for the rolling 'main' channel, or
// '--branch <tag> ' for a pinned tag. Throws on an invalid ref (the import-time
// check above normally catches it first; this guards direct callers too).
export function cloneRef(channel: string): string {
  if (channel === "main") return "";
  if (!isValidRef(channel)) {
    throw new Error(`cloneRef: "${channel}" is not a valid git ref`);
  }
  return `--branch ${channel} `;
}

// Primary navigation. `href` values are page paths (base path is applied in the layout).
export const nav = [
  { label: "Home", href: "/" },
  { label: "Get Started", href: "/getting-started" },
  { label: "Generator", href: "/generator" },
  { label: "Architecture", href: "/architecture" },
  { label: "Config", href: "/config" },
  { label: "Repos", href: "/#repos" },
  { label: "Changelog", href: "/changelog" },
] as const;
