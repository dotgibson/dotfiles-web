#!/usr/bin/env node
// verify-bootstrap-flags.mjs — the drift guard for BOTH command builders. Two files
// hand-author install commands from their own flag lists: src/data/bootstrap.ts (the
// getting-started generator) and src/components/InstallBuilder.astro (the landing-page
// widget, which carries a SEPARATE inline copy). Either can drift from the repos it
// targets, so this parses each repo's REAL flag surface and fails if EITHER builder
// emits a flag the repo doesn't accept — an unknown flag hard-fails on macOS (its
// bootstrap rejects anything outside a KNOWN_FLAGS allowlist), so a wrong flag here is
// a broken copy-paste command for a real user.
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
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRepo = resolve(__dirname, '..');
const root = process.env.DOTFILES_ROOT ? resolve(process.env.DOTFILES_ROOT) : resolve(webRepo, '..');
const repoPath = (name) => join(root, name);

// Evaluate a DATA-ONLY JS literal (the type-stripped bootstrap.ts body, or the inline
// InstallBuilder.astro `platforms` array) as the completion value of a locked-down vm
// context: NO Node globals (process/require/console/…) reachable, a hard timeout, and
// runtime code-generation (eval/new Function/wasm) disabled. These inputs are committed
// repo files, but confining the parse to pure data keeps this build script from ever
// executing arbitrary JS lifted out of a source file — the completion value is the last
// expression, so callers append a bare `targets;` / wrap the literal in parens.
function evalDataLiteral(code, what) {
  try {
    return vm.runInNewContext(code, Object.create(null), {
      timeout: 1000,
      contextCodeGeneration: { strings: false, wasm: false },
    });
  } catch (e) {
    console.error(`[verify-flags] could not evaluate ${what}: ${e.message}`);
    process.exit(1);
  }
}

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
      .replace(/:\s*ModuleGroup\[\]/g, '')
      .replace(/^export const /gm, 'const ') + '\ntargets;';
  const targets = evalDataLiteral(
    js,
    'src/data/bootstrap.ts (the type-strip in loadTargets() may need updating for a new annotation)'
  );
  if (!Array.isArray(targets) || !targets.length) {
    console.error('[verify-flags] parsed bootstrap.ts but found no targets — aborting.');
    process.exit(1);
  }
  return targets;
}

// ── load the landing-page builder's SEPARATE inline flag list ─────────────────
// InstallBuilder.astro carries its own `platforms` literal (a compact widget with a
// Linux distro sub-picker), independent of bootstrap.ts, so it needs the same guard or
// it can drift and emit a bootstrap-rejecting command with CI green. Extract the literal
// the same type-free way (it's self-contained — no imports referenced inside it) and
// flatten to {repo, isPs, flags[]} rows, fanning the Linux platform out per distro
// (base flags + that distro's `extra`). Returns null if the component is absent.
function loadInstallBuilderRows() {
  const file = join(webRepo, 'src', 'components', 'InstallBuilder.astro');
  if (!existsSync(file)) return null;
  const src = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  // The top-level array is the only `]` that starts a line then closes with `;`
  // (inner arrays are indented and end with `],`), so this lazily captures the whole
  // literal without a JS parser — matching loadTargets()'s approach.
  const m = src.match(/const platforms = (\[[\s\S]*?\n\]);/);
  if (!m) {
    console.error('[verify-flags] could not locate the `platforms` array in InstallBuilder.astro.');
    console.error('[verify-flags] its shape may have changed — update loadInstallBuilderRows().');
    process.exit(1);
  }
  const platforms = evalDataLiteral(
    '(' + m[1] + ')',
    'InstallBuilder.astro platforms (its shape may have changed — update loadInstallBuilderRows())'
  );
  const rows = [];
  for (const p of platforms) {
    const isPs = p.shell === 'powershell';
    const base = (p.flags || []).map((f) => f.flag);
    if (p.distros) {
      for (const d of p.distros) {
        rows.push({ id: `${p.id}:${d.id}`, repo: d.repo, isPs, flags: [...base, ...(d.extra || []).map((f) => f.flag)] });
      }
    } else {
      rows.push({ id: p.id, repo: p.repo, isPs, flags: base });
    }
  }
  return rows;
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

  // A `modules: true` target's generator emits --only/--skip (the module multi-select).
  // These aren't BootstrapFlag entries, so assert acceptance explicitly here.
  if (t.modules) {
    for (const flag of ['--only', '--skip']) {
      if (!accepted.has(flag)) {
        errors.push(
          `${t.repo} (${t.id}): bootstrap.ts sets modules:true but ${isPs ? 'install.ps1' : 'bootstrap.sh'} ` +
            `does not accept "${flag}". Accepted: ${[...accepted].sort().join(' ') || '(none parsed)'}`
        );
      }
    }
  }

  // Informational: repo flags the generator chooses not to surface (help/automation/
  // destructive are expected omissions — never an error). --only/--skip are surfaced
  // via the module selector, not as flags, so they belong here too.
  const ignore = new Set(['-h', '--help', '-q', '--quiet', '--json', '-Help', '--only', '--skip']);
  const notSurfaced = [...accepted].filter((f) => !surfaced.includes(f) && !ignore.has(f));
  if (notSurfaced.length) notes.push(`${t.repo} (${t.id}): not surfaced — ${notSurfaced.sort().join(' ')}`);
}

// ── also hold the landing-page builder to the same check ──────────────────────
// Every flag InstallBuilder.astro emits must likewise be one the target repo accepts.
// (It curates like bootstrap.ts, so we only assert its flags are ACCEPTED — not that it
// surfaces every repo flag.)
const ibRows = loadInstallBuilderRows();
if (ibRows) {
  for (const r of ibRows) {
    const file = join(repoPath(r.repo), r.isPs ? 'install.ps1' : 'bootstrap.sh');
    if (!existsSync(file)) {
      skipped++;
      notes.push(`InstallBuilder ${r.id}: ${r.repo} ${r.isPs ? 'install.ps1' : 'bootstrap.sh'} not found — skipped (repo not checked out).`);
      continue;
    }
    verified++;
    const src = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    const accepted = r.isPs ? psAcceptedFlags(src) : shAcceptedFlags(src);
    for (const flag of r.flags) {
      if (!accepted.has(flag)) {
        errors.push(
          `InstallBuilder.astro (${r.id}): surfaces "${flag}" but ${r.repo}'s ${r.isPs ? 'install.ps1' : 'bootstrap.sh'} ` +
            `does not accept it. Accepted: ${[...accepted].sort().join(' ') || '(none parsed)'}`
        );
      }
    }
  }
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
  console.error(`\n[verify-flags] ✗ ${errors.length} drift error(s) — a command builder is out of sync with the repos:`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  // Each error above names its own source; fix the flag there (or the repo bootstrap).
  console.error('\nFix the flag in the source named in each error — src/data/bootstrap.ts or ' + 'src/components/InstallBuilder.astro — (or the repo bootstrap), then re-run.');
  process.exit(1);
}

console.log(
  `\n[verify-flags] ✓ all surfaced flags are accepted by their repos ` +
    `(${verified} verified${skipped ? `, ${skipped} skipped` : ''}).`
);
