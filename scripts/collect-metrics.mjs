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

// Bail (without overwriting the committed snapshot) unless the WHOLE fleet is
// present. A partial checkout would silently commit under-counted metrics — the
// opposite of this script's "tracks the real repos" promise. The Core zsh/ tree
// must exist too, since every Core metric is read from it.
const missing = [core, ...osRepos].filter((r) => !has(r));
const coreZshMissing = has(core) && !existsSync(join(repoPath(core), 'zsh'));
if (missing.length || coreZshMissing) {
  const why = missing.length ? `missing repos: ${missing.join(', ')}` : `${core}/zsh not found`;
  console.warn(
    `[collect-metrics] ${why} under ${root} — keeping the committed ` +
      `${out.replace(webRepo + '/', '')} as-is. Check out the full fleet beside this ` +
      `repo, or set DOTFILES_ROOT to point at it.`
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
const packages = {};
const ci = {};
for (const name of [core, ...osRepos]) {
  if (!has(name)) continue;
  const pc = packageCount(name);
  if (pc != null) packages[name] = pc;
  const wf = join(repoPath(name), '.github', 'workflows');
  ci[name] =
    existsSync(wf) && readdirSync(wf).some((f) => f.endsWith('.yml') || f.endsWith('.yaml'));
}
// Kali's offensive stack is a second list — surface it separately.
const kaliOffensive = countMeaningful(
  join(repoPath('dotfiles-Kali'), 'install', 'offensive-packages.txt')
);
if (kaliOffensive != null) packages['dotfiles-Kali-offensive'] = kaliOffensive;

const publicRepos = [core, ...osRepos].filter(has).length;

// ── Changelog (parsed from each repo's canonical CHANGELOG.md) ───────────────
// The site's changelog page was a hand-curated mirror that drifted from the real
// files. Parse the newest version block (Keep a Changelog format) straight from
// source instead, so it can't go stale. Repos without a CHANGELOG.md are skipped.

// Strip the inline Markdown the files use (bold/code/italics/links) down to plain
// text — the page renders list items as text, not Markdown.
function cleanInline(s) {
  // NB: these files use `_` for italics; `*` only ever appears as literal content
  // (globs, `* main`), so we strip paired `**bold**` but never single `*`.
  return s
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(?<!\w)_([^_]+)_(?!\w)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseChangelog(name) {
  const file = join(repoPath(name), 'CHANGELOG.md');
  if (!existsSync(file)) return null;
  const lines = readFileSync(file, 'utf8').split('\n');

  // First version heading: "## [Unreleased] — suffix" or "## [vX.Y.Z] - 2026-01-02".
  let i = lines.findIndex((l) => /^##\s+\[.+\]/.test(l));
  if (i < 0) return null;
  const head = lines[i].match(/^##\s+\[([^\]]+)\]\s*(?:[-–—]\s*(.*))?$/);
  const version = head ? head[1].trim() : 'Unreleased';
  let suffix = head && head[2] ? head[2].trim() : '';
  let date;
  if (/^\d{4}-\d{2}-\d{2}$/.test(suffix)) {
    date = suffix;
    suffix = '';
  }

  // Block runs until the next "## " heading.
  const block = [];
  for (i++; i < lines.length && !/^##\s+/.test(lines[i]); i++) block.push(lines[i]);

  const groups = [];
  const pre = []; // prose before the first ### becomes the summary
  let cur = null;
  let buf = null; // lines of the item currently being built
  let sawCategory = false;
  const flush = () => {
    if (cur && buf) cur.items.push(cleanInline(buf.join(' ')));
    buf = null;
  };
  for (const raw of block) {
    const line = raw.replace(/\s+$/, '');
    const cat = line.match(/^###\s+(.*)$/);
    if (cat) {
      flush();
      sawCategory = true;
      cur = { category: cat[1].trim(), items: [] };
      groups.push(cur);
      continue;
    }
    if (!sawCategory) {
      if (line.trim()) pre.push(line.trim());
      continue;
    }
    const bullet = line.match(/^[-*]\s+(.*)$/); // top-level bullet (continuations are indented)
    if (bullet) {
      flush();
      buf = [bullet[1]];
    } else if (buf && line.trim()) {
      buf.push(line.trim());
    }
  }
  flush();

  let summary = [suffix, cleanInline(pre.join(' '))].filter(Boolean).join(' — ');
  return {
    repo: name,
    version,
    date,
    summary: summary || undefined,
    groups: groups.filter((g) => g.items.length),
  };
}

const changelog = [core, ...osRepos]
  .filter(has)
  .map(parseChangelog)
  .filter((e) => e && e.groups.length);

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
  changelog,
};

writeFileSync(out, JSON.stringify(data, null, 2) + '\n');
console.log(`[collect-metrics] wrote ${out.replace(webRepo + '/', '')}`);
const { changelog: cl, ...rest } = data;
console.log(JSON.stringify(rest, null, 2));
console.log(
  `[collect-metrics] changelog: ${cl.length} repo(s) — ` +
    cl.map((e) => `${e.repo} (${e.groups.reduce((n, g) => n + g.items.length, 0)} items)`).join(', ')
);
