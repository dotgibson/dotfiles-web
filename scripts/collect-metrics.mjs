#!/usr/bin/env node
// collect-metrics.mjs — derive real numbers from the sibling dotfiles repos and
// write them to src/data/generated.json, which the site consumes at build time.
//
// Why: the repo grid, the "by the numbers" strip, and the per-card package counts
// should reflect the ACTUAL repositories, not hand-typed literals that rot. Run
// this whenever Core or an OS repo changes, then commit the regenerated JSON.
//
//   node scripts/collect-metrics.mjs            # repos are siblings of this one
//   DOTFILES_ROOT=/path/to/repos node scripts/collect-metrics.mjs
//
// The script is deliberately defensive: if the sibling repos aren't checked out
// (e.g. on the Pages CI runner, which only clones dotfiles-web), it leaves the
// committed generated.json untouched and exits 0 rather than zeroing everything.

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRepo = resolve(__dirname, '..');
const root = process.env.DOTFILES_ROOT
  ? resolve(process.env.DOTFILES_ROOT)
  : resolve(webRepo, '..');
const out = join(webRepo, 'src', 'data', 'generated.json');

const repoPath = (name) => join(root, name);
const has = (name) => existsSync(repoPath(name));

// Count meaningful lines (skip blanks and # comments) — how package lists and
// Brewfiles are written across the fleet.
function countMeaningful(file) {
  if (!existsSync(file)) return null;
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter((l) => l.trim() && !l.trim().startsWith('#'))
    .length;
}

// Package count for one OS repo: install/packages.txt, or a Brewfile on macOS.
function packageCount(name) {
  const candidates = [
    join(repoPath(name), 'install', 'packages.txt'),
    join(repoPath(name), 'Brewfile'),
    join(repoPath(name), 'macos', 'Brewfile'),
  ];
  for (const c of candidates) {
    const n = countMeaningful(c);
    if (n != null) return n;
  }
  return null;
}

const core = 'dotfiles-core';
if (!has(core)) {
  console.warn(
    `[collect-metrics] ${core} not found under ${root} — keeping the committed ` +
      `${out.replace(webRepo + '/', '')} as-is. Set DOTFILES_ROOT to point at the repos.`
  );
  process.exit(0);
}

// ── Core metrics ────────────────────────────────────────────────────────────
const coreDir = repoPath(core);
const zshDir = join(coreDir, 'zsh');
const zshFiles = readdirSync(zshDir).filter((f) => f.endsWith('.zsh'));
// "Sourced modules" = the chain in _CORE_MODULES, i.e. every zsh/*.zsh except the
// loader itself (which sources them) and os/local (which live in the OS repos).
const sourcedModules = zshFiles.filter((f) => f !== 'loader.zsh').length;
const zshLoc = zshFiles.reduce(
  (n, f) => n + readFileSync(join(zshDir, f), 'utf8').split('\n').length,
  0
);
const gitAliases = (readFileSync(join(zshDir, 'git.zsh'), 'utf8').match(/^\s*alias /gm) || [])
  .length;
const plugins = readFileSync(join(zshDir, 'plugins.zsh'), 'utf8');
const pinnedPlugins = (plugins.match(/\b[0-9a-f]{40}\b/g) || []).length;
const completionsDir = join(zshDir, 'completions');
const completions = existsSync(completionsDir) ? readdirSync(completionsDir).length : null;
const versionFile = join(coreDir, 'core.version');
const coreVersion = existsSync(versionFile)
  ? readFileSync(versionFile, 'utf8').trim()
  : null;

// ── Per-repo package counts + CI presence ──────────────────────────────────
const osRepos = [
  'dotfiles-MacBook',
  'dotfiles-Windows',
  'dotfiles-Kali',
  'dotfiles-Fedora',
  'dotfiles-Arch',
  'dotfiles-openSUSE',
  'dotfiles-Alpine',
  'dotfiles-Gentoo',
];
const packages = {};
const ci = {};
for (const name of [core, ...osRepos]) {
  if (!has(name)) continue;
  const pc = packageCount(name);
  if (pc != null) packages[name] = pc;
  const wf = join(repoPath(name), '.github', 'workflows');
  ci[name] = existsSync(wf) && readdirSync(wf).some((f) => f.endsWith('.yml'));
}
// Kali's offensive stack is a second list — surface it separately.
const kaliOffensive = countMeaningful(
  join(repoPath('dotfiles-Kali'), 'install', 'offensive-packages.txt')
);
if (kaliOffensive != null) packages['dotfiles-Kali-offensive'] = kaliOffensive;

const publicRepos = [core, ...osRepos].filter(has).length;

const data = {
  generatedAt: new Date().toISOString().slice(0, 10),
  fleet: {
    publicRepos,
    layers: 3,
    loadOrderStages: 15, // tools … update os local (+ offensive on Kali)
  },
  core: {
    version: coreVersion,
    sourcedModules,
    zshLoc,
    gitAliases,
    pinnedPlugins,
    completions,
  },
  packages,
  ci,
};

writeFileSync(out, JSON.stringify(data, null, 2) + '\n');
console.log(`[collect-metrics] wrote ${out.replace(webRepo + '/', '')}`);
console.log(JSON.stringify(data, null, 2));
