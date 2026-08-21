#!/usr/bin/env node
// mirror-porting-matrix.mjs — the porting matrix, mirrored from dotfiles-core.
// ──────────────────────────────────────────────────────────────────────────────
// ONE implementation of the mirror, read by both workflows: data-freshness.yml
// runs it with --check (deciding whether to FAIL THE BUILD) and fleet-sync.yml
// runs it plain (deciding whether to OPEN A REFRESH PR). Same reasoning as
// scripts/data-strip.jq and scripts/fleet-repos.txt: those two are load-bearing
// in opposite directions and must never disagree about what the mirror IS, or a
// green build sits beside an open "the matrix drifted" PR — or worse, the build
// stays green on drift the bot will not PR. Before this file, the check lived as
// inline bash in data-freshness.yml and the write step did not exist at all.
//
// WHY THE WRITE STEP EXISTS. src/content/docs/reference/porting-matrix.md is a
// verbatim copy of dotfiles-core/PORTING-MATRIX.md, and until now it was the last
// cross-repo fact on this site still copied BY HAND while generated.json,
// snippets.json, corpus.json and coverage.json were all collected and
// bot-refreshed. So it rotted, twice. First by 2026-08-04, to a pre-v4.x snapshot
// naming packages that are wrong or do not exist, missing 9 of Core's 18 footnotes
// and ~15 tool rows — which is what prompted the --check half. Then again on
// 2026-08-21, within twenty minutes of Core cutting v4.14.1: that release grew the
// matrix 886 → 979 lines, and the stale copy was missing the direnv row outright
// and naming the wrong package for gum, watchexec, jujutsu and ast-grep on Gentoo
// and Alpine. This is the PUBLIC install guide, so those cells were actively
// sending readers at packages that are not there. The check caught it and then
// blocked the unrelated data-refresh PR until a human re-copied the file, which is
// exactly the manual step the fleet-sync bot exists to remove.
//
// THE REF IS THE WHOLE TRAP, and it is why this reads the API rather than the
// clone. fleet-sync clones the fleet at their DEFAULT BRANCHES, so the
// PORTING-MATRIX.md sitting in that checkout is Core's main — and mirroring main
// is WRONG here. The site documents a RELEASED Core, the --check half diffs
// against `contents/PORTING-MATRIX.md?ref=<releases/latest>`, and this page has
// already once been "fixed" by mirroring main, which broke the check the other
// way. Lagging main while matching the newest release is correct, not drift. So
// both halves resolve releases/latest and read the file AT THAT TAG, and neither
// ever touches the clone.
//
// Imports only node: builtins (fetch is a global), so CI runs it with the
// preinstalled node and no `npm ci`, the same way data-freshness.yml runs the four
// collectors. Deliberately NOT part of `npm run data`: those four are pure local
// file reads and stay runnable offline, while this one needs the network.
// ──────────────────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { readFleetRepos } from './lib/fleet-repos.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** The page we own. Its body below the marker is Core's; everything above is ours. */
const MIRROR = 'src/content/docs/reference/porting-matrix.md';
/** The canonical file in Core. */
const SOURCE = 'PORTING-MATRIX.md';
/**
 * The line that separates our header from Core's body. Anchoring on the marker
 * rather than a line count keeps this working if the frontmatter or the note is
 * ever reworded — which they have been.
 */
const MARKER = '-->';

const check = process.argv.includes('--check');
// Owner comes from the environment in CI and falls back to the canonical owner, so
// a bare local run works. The repo NAME comes from the fleet manifest rather than a
// literal: dotfiles-core is named once, in scripts/fleet-repos.txt.
const owner = process.env.OWNER || process.env.GITHUB_REPOSITORY_OWNER || 'dotgibson';
const core = readFleetRepos().core;

const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '';

/**
 * One GitHub API call. Returns the parsed body, or null on any non-OK response —
 * callers decide whether a given absence is a skip or an error, because the two
 * cases here differ (see below).
 */
async function api(path) {
  const headers = {
    accept: 'application/vnd.github+json',
    'user-agent': 'dotfiles-web-mirror-porting-matrix',
  };
  if (token) headers.authorization = `Bearer ${token}`;
  try {
    const res = await fetch(`https://api.github.com/${path}`, { headers });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Trailing blank lines are not drift — an editor can add one harmlessly. Leading
 * ones are not either: they are the gap between our marker and Core's first line.
 * Everything between them is compared byte for byte.
 */
const normalize = (s) => s.replace(/^\s*\n/, '').replace(/\s+$/, '');

// ── Resolve the release, and the file at it ────────────────────────────────────
const release = await api(`repos/${owner}/${core}/releases/latest`);
const tag = release?.tag_name;
if (!tag) {
  // Same tolerance the version guard has: an unreachable API is a skip, not a red
  // build — and, in write mode, not a reason to rewrite the page from nothing.
  console.log(
    `::warning::could not resolve the latest ${core} release tag ` +
      '(no releases yet, or the API is unreachable) — leaving the mirror alone.',
  );
  process.exit(0);
}

const file = await api(`repos/${owner}/${core}/contents/${SOURCE}?ref=${tag}`);
// A missing file, unlike an unreachable API, is a real problem: it would mean Core
// moved or deleted the canonical doc out from under this mirror, and silently
// keeping the old copy would publish a page with no source at all.
if (!file?.content && file?.encoding !== 'base64') {
  console.log(
    `::error::${owner}/${core} has no ${SOURCE} at ${tag} — the canonical source ` +
      'this page mirrors is gone or was renamed.',
  );
  process.exit(1);
}
// Buffer's base64 decoder ignores the API's line wrapping, so no unwrapping step.
const sourceBody = Buffer.from(file.content, 'base64').toString('utf8');

// ── Split our page at the marker ───────────────────────────────────────────────
const mirrorPath = join(repoRoot, MIRROR);
const current = readFileSync(mirrorPath, 'utf8');
const lines = current.split('\n');
const markerAt = lines.findIndex((l) => l === MARKER);
if (markerAt === -1) {
  console.log(
    `::error::${MIRROR} has no mirror marker comment — this cannot tell our header ` +
      'from Core\'s body. Restore the <!-- MIRROR ... --> note.',
  );
  process.exit(1);
}
const header = lines.slice(0, markerAt + 1).join('\n');
const currentBody = lines.slice(markerAt + 1).join('\n');

// ── Check, or write ────────────────────────────────────────────────────────────
if (normalize(currentBody) === normalize(sourceBody)) {
  console.log(`OK — the porting-matrix mirror is identical to ${core} at ${tag}.`);
  process.exit(0);
}

if (!check) {
  writeFileSync(mirrorPath, `${header}\n\n${sourceBody.replace(/\s+$/, '')}\n`);
  console.log(`Re-mirrored ${MIRROR} from ${core} ${SOURCE} at ${tag}.`);
  process.exit(0);
}

console.log(
  `::error::${MIRROR} has drifted from ${core}/${SOURCE} at ${tag}. This is the ` +
    'PUBLIC install guide, so the drift is shipping wrong package names to readers. ' +
    "Run 'npm run mirror' and commit the result (the fleet-sync bot does this on its " +
    'own schedule; this only means it has not got there yet). Fix Core first if Core ' +
    'is the one wrong.',
);
console.log(`--- ${core} (${tag})  +++ this repo ---`);
// Shelled out rather than hand-rolled: `diff -u` is what this check has always
// printed, and a reader comparing an old red build to a new one should see the same
// shape. head -100 equivalent — a truncation that does not admit it is truncating is
// how a reader concludes a 400-line drift was a 100-line one.
const tmp = mkdtempSync(join(tmpdir(), 'porting-matrix-'));
writeFileSync(join(tmp, 'core.md'), `${normalize(sourceBody)}\n`);
writeFileSync(join(tmp, 'web.md'), `${normalize(currentBody)}\n`);
let diff = '';
try {
  execFileSync('diff', ['-u', join(tmp, 'core.md'), join(tmp, 'web.md')], { encoding: 'utf8' });
} catch (e) {
  diff = e.stdout ?? ''; // diff exits 1 when the files differ, which is the whole point
}
const shown = diff.split('\n');
console.log(shown.slice(0, 100).join('\n'));
if (shown.length > 100) {
  console.log(`… ${shown.length - 100} more diff line(s) suppressed (showing the first 100).`);
}
process.exit(1);
