import generated from "./generated.json";

// Central site metadata. Edit these and the whole site updates.
export const site = {
  name: "dotfiles",
  title: "dotfiles — a ten-repo terminal ecosystem",
  description:
    "A portable, layered dotfiles ecosystem: one vendored Core (zsh, tmux, Neovim, git, starship, mise) shared across every machine, OS-native layers per platform, and operator role layers — offensive for Kali, defensive for Defense. Clone-and-go, fully reproducible.",
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

// Release channels surfaced by the docs version-switcher (Get Started + Generator).
// DERIVED FROM THE FLEET, not hand-maintained: scripts/collect-metrics.mjs reads
// dotfiles-core's CHANGELOG version headers and writes them to
// `generated.json.releases` (the newest few releases + the rolling 'main'). The site
// just consumes that snapshot — cut a release, regenerate the data, and the switcher
// updates itself. The docs still never hit the GitHub API at build time, so every
// published install command stays deterministic and an older rebuild can't silently
// change which versions it offers.
//
//   • 'main' is always the rolling channel — clones track the default branch, so no
//     `--branch` flag is emitted.
//   • Each tag (e.g. 'v2.2.0') pins a hermetic release: because Core is vendored via
//     `git subtree --squash`, a tagged OS-repo clone carries the exact Core it was
//     tested with, so the same three-command install works for ANY tag.
//
// Defensive: an older generated.json without `releases`, or any malformed entry,
// degrades to a main-only rolling pill rather than throwing. Typed with widened
// `string` fields (not `as const`) so the 'main' sentinel comparisons type-check.
const fleetReleases = (generated as {
  releases?: { current?: string; channels?: readonly string[] };
}).releases;
const fleetChannels = (fleetReleases?.channels ?? []).filter(
  (c): c is string => typeof c === "string" && (c === "main" || isValidRef(c)),
);
const channels = fleetChannels.length ? fleetChannels : ["main"];
const current =
  fleetReleases?.current &&
  (fleetReleases.current === "main" || isValidRef(fleetReleases.current))
    ? fleetReleases.current
    : channels[0];
export const release: { current: string; channels: readonly string[] } = {
  current,
  channels,
};

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
  { label: "Playground", href: "/playground" },
  { label: "Generator", href: "/generator" },
  { label: "Architecture", href: "/architecture" },
  { label: "Config", href: "/config" },
  { label: "Repos", href: "/#repos" },
  { label: "Changelog", href: "/changelog" },
] as const;
