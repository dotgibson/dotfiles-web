#!/usr/bin/env node
// collect-snippets.mjs — pull REAL config files from the sibling dotfiles repos and
// write them to src/data/snippets.json, which the Config Explorer page renders inline
// (syntax-highlighted) at build time.
//
// Why: the site described the system in prose but never SHOWED a line of the actual
// config — the one thing a terminal audience actually wants to see before cloning.
// This bakes a curated, representative slice of the real files (Core + per-OS overlays
// + the offensive role layer) into the static build, with a "view full file" link to
// GitHub for the rest.
//
//   node scripts/collect-snippets.mjs            # repos are siblings of this one
//   DOTFILES_ROOT=/path/to/repos node scripts/collect-snippets.mjs
//
// Defensive, exactly like collect-metrics.mjs: if a sibling repo isn't checked out
// (the Pages CI runner only clones dotfiles-web), the committed snippets.json is left
// untouched and the script exits 0 — so a partial checkout can't blank the page.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRepo = resolve(__dirname, '..');
const root = process.env.DOTFILES_ROOT
  ? resolve(process.env.DOTFILES_ROOT)
  : resolve(webRepo, '..');
const out = join(webRepo, 'src', 'data', 'snippets.json');

const MAX_LINES = 140; // cap a baked file; the rest is one click away on GitHub

// The curated slice — one representative file per idea, grouped by the three layers.
// Keep it tight: a few punchy files that SHOW the model, not a mirror of every repo.
const CURATED = [
  // ── Core: authored once, identical everywhere ──
  { layer: 'core', repo: 'dotfiles-core', path: 'zsh/aliases.zsh', lang: 'bash',
    title: 'zsh/aliases.zsh', blurb: 'Modern-CLI aliases (eza, bat, rg, fd…), each guarded by a tools.zsh capability check so a missing tool never breaks the shell.' },
  { layer: 'core', repo: 'dotfiles-core', path: 'starship/starship.toml', lang: 'toml',
    title: 'starship/starship.toml', blurb: 'The Tokyo Night prompt — symlinked to starship’s default path, so no STARSHIP_CONFIG env is needed.' },
  { layer: 'core', repo: 'dotfiles-core', path: 'tmux/tmux.reset.conf', lang: 'bash',
    title: 'tmux/tmux.reset.conf', blurb: 'The keybinding layer (prefix C-a lives here), sourced first by tmux.conf so the bindings are the single source of truth.' },
  // ── OS-native: the same idea, one package manager apart ──
  { layer: 'os', repo: 'dotfiles-Fedora', path: 'os/fedora.zsh', lang: 'bash',
    title: 'os/fedora.zsh', blurb: 'Fedora overlay: dnf aliases + RPM-specific conveniences. The template the other Linux repos are stamped from.' },
  { layer: 'os', repo: 'dotfiles-Arch', path: 'os/arch.zsh', lang: 'bash',
    title: 'os/arch.zsh', blurb: 'Arch overlay: pacman/AUR aliases + the never-partial-upgrade discipline. Same shape as Fedora, different package manager.' },
  { layer: 'os', repo: 'dotfiles-MacBook', path: 'os/macos.zsh', lang: 'bash',
    title: 'os/macos.zsh', blurb: 'macOS overlay: Homebrew + pbcopy/pbpaste clipboard. Its own lineage, not stamped from the Fedora template.' },
  { layer: 'os', repo: 'dotfiles-Alpine', path: 'os/alpine.zsh', lang: 'bash',
    title: 'os/alpine.zsh', blurb: 'Alpine overlay: apk + doas (not sudo) + musl realities. The lean outlier of the fleet.' },
  // ── Role: the offensive layer, on top of the OS layer ──
  { layer: 'role', repo: 'dotfiles-Kali', path: 'offensive/offensive.zsh', lang: 'bash',
    title: 'offensive/offensive.zsh', blurb: 'Engagement field helpers: lhost (your VPN IP), ttyup (TTY-stabilise a shell), note (timestamped engagement log), mkengagement (scope-first workspace).' },
];

function load(entry) {
  const file = join(root, entry.repo, entry.path);
  if (!existsSync(file)) return null;
  const raw = readFileSync(file, 'utf8').replace(/\s+$/, '');
  const allLines = raw.split('\n');
  const total = allLines.length;
  const truncated = total > MAX_LINES;
  const content = truncated ? allLines.slice(0, MAX_LINES).join('\n') : raw;
  return {
    id: `${entry.repo}:${entry.path}`,
    layer: entry.layer,
    repo: entry.repo,
    path: entry.path,
    lang: entry.lang,
    title: entry.title,
    blurb: entry.blurb,
    url: `https://github.com/Gerrrt/${entry.repo}/blob/main/${entry.path}`,
    content,
    total,
    shown: truncated ? MAX_LINES : total,
    truncated,
  };
}

const snippets = CURATED.map(load).filter(Boolean);

// Bail without overwriting the committed snapshot unless we resolved the WHOLE curated
// set — a partial checkout would silently drop files from the page.
if (snippets.length !== CURATED.length) {
  console.warn(
    `[collect-snippets] resolved ${snippets.length}/${CURATED.length} files under ${root} ` +
      `— keeping the committed ${out.replace(webRepo + '/', '')} as-is. Check out the full ` +
      `fleet beside this repo, or set DOTFILES_ROOT.`,
  );
  process.exit(0);
}

writeFileSync(out, JSON.stringify({ generatedFrom: 'sibling repos', snippets }, null, 2) + '\n');
console.log(`[collect-snippets] wrote ${snippets.length} snippets to ${out.replace(webRepo + '/', '')}`);
