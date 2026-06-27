#!/usr/bin/env node
// verify-bootstrap-flags.mjs — the drift guard for the Bootstrap Command Generator
// (design doc §1.4). src/data/bootstrap.ts is hand-authored, so this checks it can
// never drift from the repos it generates commands for: it parses each repo's REAL
// flag surface and fails if bootstrap.ts emits a flag the repo doesn't accept.
//
//   node scripts/verify-bootstrap-flags.mjs            # repos are siblings of this one
//   DOTFILES_ROOT=/path/to/repos node scripts/verify-bootstrap-flags.mjs
//   npm run verify:flags
//
// Direction matters. The generator INTENTIONALLY curates — it surfaces only the
// user-meaningful flags and omits automation/destructive ones (--uninstall, --json,
// --quiet, -Yes, ...). So:
//   • ERROR (exit 1): bootstrap.ts lists a flag a repo does NOT accept. These are
//     typos/drift and hard-fail on macOS (its bootstrap rejects unknown flags via a
//     KNOWN_FLAGS allowlist), so they must never ship.
//   • NOTE (informational): repo flags bootstrap.ts doesn't surface — expected,
//     reported for visibility, never a failure.
//
// Defensive, like collect-metrics.mjs: if the sibling repos aren't checked out
// (e.g. the Pages CI runner only clones dotfiles-web), it can't verify anything, so
// it warns and exits 0 rather than failing a build it has no data for.

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRepo = resolve(__dirname, '..');
const root = process.env.DOTFILES_ROOT ? resolve(process.env.DOTFILES_ROOT) : resolve(webRepo, '..');
const repoPath = (name) => join(root, name);

// ── load the resolved targets from bootstrap.ts ──────────────────────────────
// The file is data-only after its type layer, so strip the types and evaluate the
// literal — this gives the EXACT resolved data (shared flag consts included) without
// reimplementing a TS parser. Fails loud if the shape changes unexpectedly.
function loadTargets() {
  const file = join(webRepo, 'src', 'data', 'bootstrap.ts');
  // Normalise CRLF → LF so the type-strip regexes match on a Windows checkout
  // (git may have converted line endings), not just an LF working tree.
  const src = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const js =
    src
      .replace(/export type \w+ =[^\n]*\n/g, '')
      .replace(/export interface \w+ \{[\s\S]*?\n\}\n/g, '')
      .replace(/:\s*BootstrapFlag\b/g, '')
      .replace(/:\s*BootstrapTarget\[\]/g, '')
      .replace(/^export const /gm, 'const ') + '\nreturn targets;';
  let targets;
  try {
    // eslint-disable-next-line no-new-func
    targets = Function(js)();
  } catch (e) {
    console.error(`[verify-flags] could not parse src/data/bootstrap.ts: ${e.message}`);
    console.error('[verify-flags] the type-strip in loadTargets() may need updating for a new annotation.');
    process.exit(1);
  }
  if (!Array.isArray(targets) || !targets.length) {
    console.error('[verify-flags] parsed bootstrap.ts but found no targets — aborting.');
    process.exit(1);
  }
  return targets;
}

// ── parse a repo's real flag surface ─────────────────────────────────────────
// sh bootstrap: every `case` arm token, e.g. `--links-only)`, `--dry-run | -n)`,
// `-h|--help)`, plus macOS's authoritative `KNOWN_FLAGS=( ... )` allowlist.
function shAcceptedFlags(src) {
  const flags = new Set();
  const armRe = /^\s*((?:-{1,2}[A-Za-z][\w-]*\s*\|\s*)*-{1,2}[A-Za-z][\w-]*)\)/gm;
  let m;
  while ((m = armRe.exec(src))) {
    for (let t of m[1].split('|')) {
      t = t.trim();
      if (/^-{1,2}[A-Za-z]/.test(t)) flags.add(t);
    }
  }
  const kf = src.match(/KNOWN_FLAGS=\(([^)]*)\)/);
  if (kf) for (const t of kf[1].split(/\s+/)) if (/^-{1,2}[A-Za-z]/.test(t.trim())) flags.add(t.trim());
  return flags;
}

// pwsh install.ps1: the SCRIPT-LEVEL param() switches, e.g. `[switch]$SkipPackages`
// → `-SkipPackages`. Scope to the top-level param block only — scanning the whole
// file would also pick up internal helper-function params (-Link, -Target, ...) and
// wrongly accept them. The block is the first `param(` up to a line that closes it
// with `)` (its comments contain stray parens, so we delimit on a `)` at line start,
// not paren-counting).
function psAcceptedFlags(src) {
  const flags = new Set();
  const start = src.search(/\bparam\s*\(/i); // tolerate `param (` with a space
  if (start < 0) return flags;
  const after = src.slice(start);
  const end = after.search(/\n\s*\)/); // closing `)` may be indented
  const block = end >= 0 ? after.slice(0, end) : after;
  const re = /\[(?:switch|string|int|bool|object(?:\[\])?)\]\s*\$(\w+)/gi;
  let m;
  while ((m = re.exec(block))) flags.add('-' + m[1]);
  return flags;
}

// ── verify ───────────────────────────────────────────────────────────────────
const targets = loadTargets();
const errors = [];
const notes = [];
let verified = 0;
let skipped = 0;

for (const t of targets) {
  const isPs = t.dialect === 'ps';
  const file = join(repoPath(t.repo), isPs ? 'install.ps1' : 'bootstrap.sh');
  if (!existsSync(file)) {
    skipped++;
    notes.push(`${t.repo}: ${isPs ? 'install.ps1' : 'bootstrap.sh'} not found — skipped (repo not checked out).`);
    continue;
  }
  verified++;
  const src = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const accepted = isPs ? psAcceptedFlags(src) : shAcceptedFlags(src);
  const surfaced = t.flags.map((f) => f.flag);

  for (const flag of surfaced) {
    if (!accepted.has(flag)) {
      errors.push(
        `${t.repo} (${t.id}): bootstrap.ts surfaces "${flag}" but ${isPs ? 'install.ps1' : 'bootstrap.sh'} ` +
          `does not accept it. Accepted: ${[...accepted].sort().join(' ') || '(none parsed)'}`
      );
    }
  }

  // Informational: repo flags the generator chooses not to surface (help/automation/
  // destructive are expected omissions — never an error).
  const ignore = new Set(['-h', '--help', '-q', '--quiet', '--json', '-Help']);
  const notSurfaced = [...accepted].filter((f) => !surfaced.includes(f) && !ignore.has(f));
  if (notSurfaced.length) notes.push(`${t.repo} (${t.id}): not surfaced — ${notSurfaced.sort().join(' ')}`);
}

// All repos missing → nothing to verify; skip rather than fail a dist-only build.
if (verified === 0) {
  console.warn(
    `[verify-flags] no repo bootstraps found under ${root} — nothing to verify. Check out the ` +
      `full fleet beside this repo, or set DOTFILES_ROOT to point at it.`
  );
  process.exit(0);
}

if (notes.length) {
  console.log('[verify-flags] notes (informational):');
  for (const n of notes) console.log(`  · ${n}`);
}

if (errors.length) {
  console.error(`\n[verify-flags] ✗ ${errors.length} drift error(s) — bootstrap.ts is out of sync:`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  console.error('\nFix the flag in src/data/bootstrap.ts (or the repo bootstrap), then re-run.');
  process.exit(1);
}

console.log(
  `\n[verify-flags] ✓ all surfaced flags are accepted by their repos ` +
    `(${verified} verified${skipped ? `, ${skipped} skipped` : ''}).`
);
