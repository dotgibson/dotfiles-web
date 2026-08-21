#!/usr/bin/env node
// verify-fleet-manifest.mjs — assert nothing has re-inlined a copy of the fleet.
//
// scripts/fleet-repos.txt is now the one list, read by .github/actions/clone-fleet and
// by collect-metrics.mjs. Before that it was hand-maintained in five places, and the
// copy nobody was watching had already lost dotfiles-Debian. Deduplication removed the
// copies; this removes the way back — an inline loop added in a hurry fails here
// instead of quietly becoming the sixth source of truth.
//
// Cheap on purpose: it clones nothing and re-derives nothing, it just reads files.
// Same shape as verify-bootstrap-flags.mjs — accumulate every offender and name it,
// because reporting one at a time turns one fix into several round trips through CI.

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFleetRepos } from './lib/fleet-repos.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];

const { all, core, os } = readFleetRepos();

// ── 1. No workflow may re-inline the repo list or the strip filter ──────────────
// Patterns match the exact shapes that used to live in these files, so the message
// can name the fix rather than just the offence.
const BANNED = [
  [/for\s+r\s+in\s+dotfiles-/, 'an inline fleet clone loop', 'use .github/actions/clone-fleet'],
  [/repos=["']dotfiles-/, 'an inline fleet repo list', 'use .github/actions/clone-fleet'],
  [/strip=['"]del\(/, 'an inline data-strip jq filter', 'use `jq -f scripts/data-strip.jq`'],
];

const wfDir = join(repoRoot, '.github', 'workflows');
for (const file of readdirSync(wfDir).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))) {
  const lines = readFileSync(join(wfDir, file), 'utf8').split('\n');
  for (const [pattern, what, fix] of BANNED) {
    lines.forEach((line, i) => {
      if (pattern.test(line)) {
        problems.push(`.github/workflows/${file}:${i + 1} carries ${what} — ${fix}.`);
      }
    });
  }
}

// ── 2. src/data/repos.ts must name the same fleet the manifest does ─────────────
// The site's repo grid, per-repo hub pages, architecture diagram and /status all read
// repos.ts, so a repo added to the manifest but not here is published as not existing —
// and one removed from the manifest but left here renders a card for a repo CI no longer
// reads. Names only; repos.ts owns the prose and the layer split, which is not duplication.
const reposTs = readFileSync(join(repoRoot, 'src', 'data', 'repos.ts'), 'utf8');
const declared = [...reposTs.matchAll(/^\s*name:\s*'([^']+)'/gm)].map((m) => m[1]);
const expected = [core, ...os]; // htpx is `aux`: a corpus source, not a fleet repo the site lists

for (const name of expected) {
  if (!declared.includes(name)) {
    problems.push(`src/data/repos.ts does not list ${name}, which scripts/fleet-repos.txt names.`);
  }
}
for (const name of declared) {
  if (!expected.includes(name)) {
    problems.push(`src/data/repos.ts lists ${name}, which scripts/fleet-repos.txt does not name.`);
  }
}

// ── Report ─────────────────────────────────────────────────────────────────────
if (problems.length) {
  console.error('✗ fleet manifest check failed:\n');
  for (const p of problems) console.error(`  • ${p}`);
  console.error('\nThe fleet is named once, in scripts/fleet-repos.txt. Everything else reads it.');
  process.exit(1);
}

console.log(
  `✓ fleet manifest is the only list — ${all.length} repos (${expected.length} in repos.ts), ` +
    'no workflow re-inlines it.',
);
