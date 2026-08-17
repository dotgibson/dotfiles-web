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
//
// And, exactly like collect-metrics.mjs, that lenient default is how a stale snapshot
// silently ships: an "about to publish" run that resolves none of the fleet keeps the
// old file and exits clean. Pass --strict (or STRICT=1) so a partial resolve is a HARD
// ERROR (exit 1) instead. `npm run data` passes it; `npm run data:lenient` does not.
//
// This script was the last link in `npm run data` without that flag, which made the
// whole pipeline only as fail-closed as its weakest step: metrics, corpus and coverage
// each refuse a missing fleet, while this one shrugged and returned 0. A publish run
// that resolved nothing therefore kept the committed snapshot and reported success.
//
// resolveFleetRoot() below now finds the fleet from a linked worktree as well, which
// removes the likeliest way to resolve 0/8 by accident — but not the possibility. A
// non-standard layout, a genuinely absent sibling, or a curated path renamed upstream
// all still land on the bail branch, and in every one of those cases republishing the
// previous snapshot as though it were current is the wrong answer. Which of the two
// behaviours you get is the point of the flag, not an implementation detail.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRepo = resolve(__dirname, '..');

// Any repo CURATED reads, used only to test whether a candidate directory IS the fleet.
// Core is the safe pick: it is the one repo the curated set can never stop naming.
const FLEET_SENTINEL = 'dotfiles-core';

// Where the fleet lives, in precedence order:
//
//   1. DOTFILES_ROOT, if set — an explicit answer always wins.
//   2. Beside this checkout — the ordinary case, dotfiles-web sitting in the fleet dir.
//   3. Beside the MAIN worktree — the case (2) cannot reach.
//
// Step 3 exists because a LINKED WORKTREE lives outside the fleet directory, so `..`
// from it holds no repos. That stopped being an edge case when per-session worktrees
// became the way to keep concurrent sessions from sharing one checkout: without this,
// a bare run from a worktree resolves 0/8 files and exits 0 keeping the committed
// snapshot — silently publishing stale content, which for THIS collector means stale
// config source rendered on /config as the real thing.
//
// `git rev-parse --git-common-dir` resolves to the MAIN worktree's .git even when run
// from a linked one, so its grandparent is the fleet directory. In a normal clone it
// resolves to our own .git and step 3 lands back on step 2's answer — hence the
// `!== beside` guard, which makes this a no-op off the worktree path. Step 2 also
// returns early whenever the fleet is beside us, so an ordinary clone never runs git.
function resolveFleetRoot() {
  if (process.env.DOTFILES_ROOT) {
    return { root: resolve(process.env.DOTFILES_ROOT), via: 'DOTFILES_ROOT' };
  }

  const beside = resolve(webRepo, '..');
  if (existsSync(join(beside, FLEET_SENTINEL))) return { root: beside, via: 'siblings' };

  try {
    const commonDir = execFileSync('git', ['-C', webRepo, 'rev-parse', '--git-common-dir'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    // --git-common-dir may answer relatively (a bare ".git"); resolve against webRepo.
    const mainWorktree = dirname(resolve(webRepo, commonDir));
    const fromMain = resolve(mainWorktree, '..');
    if (fromMain !== beside && existsSync(join(fromMain, FLEET_SENTINEL))) {
      return { root: fromMain, via: 'main worktree' };
    }
  } catch {
    // No git, or not a checkout. Fall through — the resolve-count check below reports it.
  }

  // Nothing found. Return the conventional answer so the existing warning names the
  // path a reader expects. CI (which clones dotfiles-web alone) lands here and keeps
  // its current behaviour exactly.
  return { root: beside, via: 'siblings' };
}

const { root, via: rootVia } = resolveFleetRoot();
if (rootVia === 'main worktree') {
  // Say so. Silently reaching outside this checkout for inputs is the kind of thing
  // that should appear in a build log, not be inferred later from a surprising diff.
  console.log(`[collect-snippets] running from a linked worktree — reading the fleet at ${root}`);
}
const out = join(webRepo, 'src', 'data', 'snippets.json');

// Cap a baked file; the rest is one click away on GitHub. Set from the shape of the
// curated set rather than picked round: the OS/role overlays cluster at 96-144 lines
// and the long reference files start at 200 (Core's aliases, starship.toml, Kali's
// offensive.zsh), so anything in that gap keeps every overlay whole while still
// capping the three that actually need it. At 140 this truncated Arch's 144-line
// overlay to hide FOUR lines behind a "read the full file" link — all the cost of
// truncation for none of the benefit. 160 leaves that gap's headroom on the overlays
// (Arch grew 138 -> 144 in three days), so ordinary growth doesn't re-trip it.
const MAX_LINES = 160;

// The curated slice — one representative file per idea, grouped by the three layers.
// Keep it tight: a few punchy files that SHOW the model, not a mirror of every repo.
const CURATED = [
  // ── Core: authored once, identical everywhere ──
  { layer: 'core', repo: 'dotfiles-core', path: 'zsh/20-aliases.zsh', lang: 'bash',
    title: 'zsh/20-aliases.zsh', blurb: 'Modern-CLI aliases (eza, bat, rg, fd…), each guarded by a capability check (HAVE_* flags) so a missing tool never breaks the shell.' },
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
  // Strip only trailing NEWLINES (a final \n would otherwise bake an empty last line),
  // not all trailing whitespace — so the snippet stays a faithful "as-is" copy, intentional
  // trailing spaces on the last line included.
  const raw = readFileSync(file, 'utf8').replace(/\n+$/, '');
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
    url: `https://github.com/dotgibson/${entry.repo}/blob/main/${entry.path}`,
    content,
    total,
    shown: truncated ? MAX_LINES : total,
    truncated,
  };
}

const strict = process.argv.includes('--strict') || process.env.STRICT === '1';
const rel = relative(webRepo, out);

// Bail without overwriting the committed snapshot unless we resolved the WHOLE curated
// set — a partial checkout would silently drop files from the page.
const loaded = CURATED.map((entry) => ({ entry, snippet: load(entry) }));
const snippets = loaded.map((r) => r.snippet).filter(Boolean);
// Name the files that did not resolve, rather than only counting them. "8/9" sends you
// diffing the curated list against ten checkouts by hand; the path says at once whether
// a repo is absent, a file was renamed upstream, or the root is wrong.
const unresolved = loaded.filter((r) => !r.snippet).map((r) => `${r.entry.repo}/${r.entry.path}`);

if (unresolved.length) {
  const why =
    `resolved ${snippets.length}/${CURATED.length} curated files under ${root} — ` +
    `missing: ${unresolved.join(', ')}`;
  const tail = `Check out the full fleet beside this repo, or set DOTFILES_ROOT to point at it.`;
  if (strict) {
    // Publish path: refuse to leave a possibly-stale snapshot in place silently.
    console.error(`[collect-snippets] STRICT: ${why} — cannot regenerate ${rel}. ${tail}`);
    process.exit(1);
  }
  console.warn(
    `[collect-snippets] ${why} — keeping the committed ${rel} as-is. ${tail} ` +
      `(pass --strict to fail instead.)`,
  );
  process.exit(0);
}

writeFileSync(out, JSON.stringify({ generatedFrom: 'sibling repos', snippets }, null, 2) + '\n');
console.log(`[collect-snippets] wrote ${snippets.length} snippets to ${rel}`);
