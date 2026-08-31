#!/usr/bin/env node
// collect-palette.mjs — derive the site's Tokyo Night palette from the sibling
// dotfiles-core's theme/palette.toml, so the colours this site SHOWS are the colours
// Core actually ships rather than a hand-kept copy of them.
//
// Why: the site is the system's public face. It renders terminal mockups, a hero
// banner and a "One palette, every surface" swatch gallery that are supposed to SHOW
// what the dotfiles look like. Until now every one of those hexes was typed here, so
// nothing could notice the site depicting a palette Core no longer ships — which had
// already happened: --tn-magenta was #c678dd, One Dark's magenta, not Tokyo Night's.
// Core closed this for itself in dotfiles-core#679 (theme/palette.toml + gen-theme.sh
// + a `make audit` gate); this is the same idea reaching one repo further out.
//
//   node scripts/collect-palette.mjs            # dotfiles-core is a sibling of this repo
//   node scripts/collect-palette.mjs --check    # exit 1 (with a diff) if an output is stale
//   DOTFILES_ROOT=/path/to/repos node scripts/collect-palette.mjs
//
// TWO OUTPUTS, both committed:
//   src/data/palette.json   the table + provenance, imported by terminal.ts and Palette.astro
//   src/styles/global.css   the `web:theme:gen palette` block, and ONLY that block
//
// WHY A MARKED BLOCK AND NOT A SEPARATE _palette.css. The obvious shape is to emit a
// standalone stylesheet and @import it. It builds fine — and it silently breaks
// Palette.astro, which reads `global.css?raw` and regex-matches `--tn-x: #hex` to print
// each swatch's label. `?raw` hands back the file's literal bytes, so with the tokens
// moved out every label would fall through to that component's '#000000' sentinel: a
// black hex printed under a blue chip, with no error anywhere. The single invariant
// that component exists to hold is that the chip and its label trace to ONE source and
// therefore cannot disagree. A marked block keeps it. It is also the fleet's own idiom
// — Core's scripts/gen-theme.sh renders 16 such blocks, and this repo's
// mirror-porting-matrix.mjs already does marker-anchored rewriting.
//
// NOTHING PER-RUN GOES IN THE CSS BLOCK — no generatedAt, no SHA, no style. global.css
// is not JSON, so scripts/data-strip.jq cannot reach it and its drift is checked with a
// plain `git diff` (the precedent mirror-porting-matrix.mjs sets for the porting
// matrix). One byte that varies per run would make fleet-sync open a refresh PR every
// single day. Provenance lives in palette.json, where the filter strips it.
//
// WHY THE SIBLING WORKING TREE AND NOT releases/latest. mirror-porting-matrix.mjs
// deliberately reads Core's GitHub release, because the porting matrix is a CLAIM ABOUT
// A RELEASED CORE — mirroring main there publishes install instructions for software
// nobody can get yet, and that page has been broken in both directions by getting the
// ref wrong. The palette is not a claim about anything: it is this site's own chrome,
// and nobody installs a colour. So it takes the four collectors' relationship with
// their sources instead — read the sibling's working tree — which also keeps this
// runnable offline, the reason those four are separate from the mirror in the first place.
//
// Defensive like the other collectors: a missing dotfiles-core leaves the committed
// outputs untouched and exits 0, so a partial checkout cannot blank the site's palette.
// Pass --strict (or STRICT=1) to make that a hard error instead; `npm run data` does.
//
// ONE EXTRA LENIENCY, AND IT IS NOT THE SAME AXIS. A dotfiles-core that is checked out
// but whose commit PREDATES theme/palette.toml warns and keeps the committed outputs
// even under --strict. The other collectors' strict axis is "is the source repo checked
// out?", a question about THIS RUN's environment. "Does this Core COMMIT carry the
// palette?" is a question about a VERSION, and the honest answer is "this Core predates
// the palette; there is nothing to regenerate" — not "fail the build". It is load-
// bearing, not cosmetic: data-freshness.yml's derived-data job replays the fleet at the
// commits the committed data names, and deploy.yml's pinned-release build clones at a
// TAG. Both currently resolve a Core older than the palette, so a hard failure here
// would break every pull request and every pinned deploy. The leniency self-retires
// once the pins move past it.

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveFleetRoot } from './lib/fleet-root.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRepo = resolve(__dirname, '..');

const { root, via: rootVia } = resolveFleetRoot(webRepo);
if (rootVia === 'main worktree') {
  // Say so. Silently reaching outside this checkout for inputs is the kind of thing
  // that should appear in a build log, not be inferred later from a surprising diff.
  console.log(`[collect-palette] running from a linked worktree — reading the fleet at ${root}`);
}

const strict = process.argv.includes('--strict') || process.env.STRICT === '1';
const check = process.argv.includes('--check');

const SRC_REPO = 'dotfiles-core';
const SRC_PATH = 'theme/palette.toml';
const coreDir = join(root, SRC_REPO);
const paletteToml = join(coreDir, SRC_PATH);

const jsonOut = join(webRepo, 'src', 'data', 'palette.json');
const cssOut = join(webRepo, 'src', 'styles', 'global.css');
const relJson = relative(webRepo, jsonOut);
const relCss = relative(webRepo, cssOut);

// ── which CSS token is which Core colour ─────────────────────────────────────
// Ordered as they appear in global.css, so a regeneration diffs as clean value
// changes rather than a reshuffle. Every pair below is byte-equal today, which is
// what makes adopting the generator a no-op rather than a restyle.
//
// The NAMES do not line up with Core's, and are not made to. Core names a colour for
// what tokyonight calls it; this site names it for the job it does in a web layout.
// `--tn-purple` = `color_magenta` is the clearest case: the site has called it purple
// since its first commit, and renaming ~40 usages to chase Core's vocabulary would be
// churn in service of nothing a reader of either repo needs.
const BINDINGS = [
  ['--tn-bg-storm', 'bg'],
  ['--tn-surface', 'bg_dark'],
  ['--tn-surface-2', 'bg_highlight'],
  ['--tn-fg', 'fg'],
  ['--tn-fg-dim', 'fg_dark'],
  ['--tn-comment', 'comment'],
  ['--tn-blue', 'blue'],
  ['--tn-cyan', 'cyan'],
  ['--tn-purple', 'magenta'],
  ['--tn-green', 'green'],
  ['--tn-red', 'red'],
  ['--tn-orange', 'orange'],
  ['--tn-yellow', 'yellow'],
];

// Colours that must resolve or this is not a palette we understand. The bound set,
// plus bg_visual — which gets no CSS token (nothing in the page paints with it) but
// is read by src/data/terminal.ts for the playground terminal's selection highlight.
// A missing key fails ONCE here, loudly, instead of emitting an empty colour into
// every consumer — the argument Core's own _pal_require makes.
const REQUIRED_COLORS = [
  ...BINDINGS.map(([, key]) => key),
  'bg_visual',
];

const MARK_OPEN = 'web:theme:gen palette';
const MARK_CLOSE = 'web:theme:end palette';

const die = (msg) => {
  console.error(`[collect-palette] ${msg}`);
  process.exit(1);
};

// ── parse ────────────────────────────────────────────────────────────────────
// theme/palette.toml is deliberately flat — no [tables], one `key = "#hex"` per line —
// so that Core's own gen-theme.sh can read it with one awk regex and no TOML library.
// That discipline is worth honouring rather than reaching for a dependency: this script
// runs in data-freshness.yml's derived-data job, which has no setup-node and no npm ci.
//
// The order of the alternation is the load-bearing part. A naive comment-strip would
// EAT THE VALUE, because every colour in the file starts with `#` — the same trap Core's
// awk calls out. Matching the QUOTED form first means the hex is captured before
// anything looks for a comment.
const KV = /^([a-z][a-z0-9_]*)\s*=\s*(?:"([^"]*)"|([^#\n]*?))\s*(?:#.*)?$/;

function parsePalette(text) {
  const raw = {};
  for (const line of text.split('\n')) {
    const m = line.match(KV);
    if (!m) continue;
    raw[m[1]] = m[2] !== undefined ? m[2] : (m[3] ?? '').trim();
  }
  return raw;
}

// ── resolve the source ───────────────────────────────────────────────────────
const bail = (why, tail) => {
  if (strict) {
    console.error(`[collect-palette] STRICT: ${why} — cannot regenerate ${relJson} / the ${MARK_OPEN} block. ${tail}`);
    process.exit(1);
  }
  console.warn(`[collect-palette] ${why} — keeping the committed outputs as-is. ${tail} (pass --strict to fail instead.)`);
  process.exit(0);
};

if (!existsSync(coreDir)) {
  bail(
    `no ${SRC_REPO} under ${root}`,
    'Check out the fleet beside this repo, or set DOTFILES_ROOT to point at it.',
  );
}

if (!existsSync(paletteToml)) {
  // The VERSION case, not the environment case — see the header. Deliberately lenient
  // even under --strict, because "this Core predates the palette" is a true and
  // survivable answer, and failing here would break every pinned replay and deploy.
  const head = gitIn(coreDir, ['rev-parse', '--short', 'HEAD']);
  console.warn(
    `[collect-palette] ${SRC_REPO}${head ? ` at ${head.trim()}` : ''} has no ${SRC_PATH} — ` +
      `this Core predates dotfiles-core#679, so there is nothing to regenerate. ` +
      `Keeping the committed ${relJson} and the ${MARK_OPEN} block as-is.`,
  );
  process.exit(0);
}

const parsed = parsePalette(readFileSync(paletteToml, 'utf8'));

// A schema bump means Core changed the contract. Fail loudly rather than mis-map it
// silently onto the old key names and repaint the site from a misreading.
if (parsed.schema !== '1') {
  die(
    `${SRC_PATH} declares schema = ${parsed.schema ?? '(none)'}, but this generator ` +
      `understands schema 1. Core changed the palette contract — reread ${SRC_PATH} ` +
      `and update BINDINGS before regenerating.`,
  );
}

const colors = {};
for (const [k, v] of Object.entries(parsed)) {
  if (k.startsWith('color_')) colors[k.slice('color_'.length)] = v;
}
const roles = {};
for (const [k, v] of Object.entries(parsed)) {
  if (k.startsWith('role_')) roles[k.slice('role_'.length)] = v;
}

const missing = REQUIRED_COLORS.filter((k) => !(k in colors));
if (missing.length) die(`${SRC_PATH} is missing required colour(s): ${missing.join(', ')}`);

const malformed = Object.entries(colors).filter(([, v]) => !/^#[0-9a-f]{6}$/.test(v));
if (malformed.length) {
  die(
    `${SRC_PATH} has non-hex colour value(s): ` +
      malformed.map(([k, v]) => `color_${k} = ${JSON.stringify(v)}`).join(', '),
  );
}

// ── provenance ───────────────────────────────────────────────────────────────
function gitIn(dir, args) {
  try {
    return execFileSync('git', ['-C', dir, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null; // not a git checkout, or no git on PATH
  }
}

const head = gitIn(coreDir, ['rev-parse', 'HEAD']);
const abbrev = (gitIn(coreDir, ['rev-parse', '--abbrev-ref', 'HEAD']) || '').trim();
// A detached HEAD abbreviates to the literal "HEAD". Recorded as a null branch and NOT
// a problem: it is a committed, addressable state the commit pins exactly, and it is
// how a pinned release build checks out.
const branch = abbrev === 'HEAD' || abbrev === '' ? null : abbrev;

// dirty is computed from the EXACT path this collector reads, not repo-wide — the
// precedent collect-snippets.mjs sets explicitly. A Core tree with a modified README
// must not block a palette refresh; a modified theme/palette.toml must.
const status = gitIn(coreDir, ['status', '--porcelain', '-z', '--', SRC_PATH]) ?? '';
const dirty = head == null ? null : status.split('\0').filter(Boolean).length > 0;

const defaultBranch =
  (gitIn(coreDir, ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']) || '')
    .trim()
    .replace(/^origin\//, '') || null;
// A clone that never set origin/HEAD resolves this to null; comparing against null
// would force offDefault false and hand back a clean verdict for a repo sitting on a
// feature branch — the exact false-clean the stamp exists to prevent. Same fallback
// collect-snippets.mjs uses.
const assumedDefault = defaultBranch ?? (['main', 'master'].includes(branch) ? branch : 'main');
const offDefault = branch != null && branch !== assumedDefault;

const unclean = [];
if (dirty) unclean.push(`${SRC_REPO} (${SRC_PATH} modified)`);
if (offDefault) unclean.push(`${SRC_REPO} (on '${branch}' not '${assumedDefault}')`);

const generatedFrom = {
  repo: SRC_REPO,
  path: SRC_PATH,
  commit: head ? head.trim() : null,
  branch,
  defaultBranch,
  dirty,
  // The verdict, so the file carries its own indictment: true — verified and clean;
  // false — the palette this was read from is not what Core publishes; null — nothing
  // dirty, but the source could not be verified (a tarball or vendored copy).
  clean: unclean.length ? false : head == null ? null : true,
  ...(unclean.length ? { unclean } : {}),
};

if (unclean.length) {
  console.warn(
    `[collect-palette] WARNING: the palette source is not publish-clean, so the site's ` +
      `chrome may not be the colours Core ships:\n` +
      unclean.map((u) => `  • ${u}`).join('\n') +
      `\nRecorded in generatedFrom.clean — the file says so about itself.`,
  );
}

// ── render ───────────────────────────────────────────────────────────────────
const paletteJson =
  JSON.stringify(
    {
      generatedAt: new Date().toISOString().slice(0, 10),
      generatedFrom,
      schema: Number(parsed.schema),
      // tokyonight's style and the plugin commit the table was RESOLVED FROM. Top level,
      // never inside generatedFrom: data-strip.jq strips generatedFrom.commit, and
      // nesting this there would let the site publish a stale upstream pin invisibly.
      style: parsed.style ?? null,
      source: {
        plugin: parsed.source ?? null,
        commit: parsed.source_commit ?? null,
      },
      // The WHOLE table, including the eight colours no CSS token binds. They cost
      // nothing here and make this file an honest record of what Core ships rather
      // than of what this site happens to use today.
      colors,
      roles,
    },
    null,
    2,
  ) + '\n';

// The CSS block. Value lines only — see the header on why nothing per-run may appear
// between the markers.
function renderBlock(indent) {
  const width = Math.max(...BINDINGS.map(([v]) => v.length));
  return BINDINGS.map(
    ([cssVar, key]) =>
      `${indent}${cssVar}: ${colors[key]};`.padEnd(indent.length + width + colors[key].length + 3) +
      `  /* core: color_${key} */`,
  );
}

function replaceBlock(css) {
  const lines = css.split('\n');
  const openIdx = lines.findIndex((l) => l.includes(MARK_OPEN));
  const closeIdx = lines.findIndex((l) => l.includes(MARK_CLOSE));

  // Refuse rather than guess. mirror-porting-matrix.mjs makes the same call for the
  // same reason: a generator that silently appends when it cannot find its anchor
  // turns one bad edit into a file nobody can regenerate.
  if (openIdx === -1 || closeIdx === -1) {
    die(
      `${relCss} has no ${openIdx === -1 ? MARK_OPEN : MARK_CLOSE} marker. Restore the ` +
        `marker pair before regenerating — refusing to guess where the palette block goes.`,
    );
  }
  if (closeIdx <= openIdx) {
    die(`${relCss} has its ${MARK_CLOSE} marker before ${MARK_OPEN}. Refusing to write.`);
  }
  if (lines.filter((l) => l.includes(MARK_OPEN)).length > 1 ||
      lines.filter((l) => l.includes(MARK_CLOSE)).length > 1) {
    die(`${relCss} has more than one palette marker pair. Refusing to write.`);
  }

  const indent = (lines[openIdx].match(/^\s*/) || [''])[0];
  return [...lines.slice(0, openIdx + 1), ...renderBlock(indent), ...lines.slice(closeIdx)].join('\n');
}

const currentCss = readFileSync(cssOut, 'utf8');
const nextCss = replaceBlock(currentCss);

// ── the brand assets, asserted rather than owned ─────────────────────────────
// public/*.svg are NOT generated. A favicon renders through a reduced, engine-specific
// rasterization path where CSS-variable-driven fills have a real history of simply not
// painting, and templating three files that change only when the theme changes would
// add a whole artifact class to every CI path filter and git-add list for no benefit.
//
// What actually went wrong there was one orphan: #e6b166, a warm amber in NO palette —
// not Core's, not this site's — sitting in all three files. So: assert instead. Every
// hex in public/*.svg must be a colour this site can name, which catches the next
// #e6b166 without this script owning brand marks.
function siteExtensions(css) {
  // Parsed out of global.css BELOW the generated block rather than duplicated here, so
  // the allowlist cannot drift from the tokens the site actually defines.
  const out = {};
  for (const m of css.matchAll(/(--[a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8})/g)) out[m[1]] = m[2].toLowerCase();
  return out;
}

function assertSvgPalette(css) {
  const known = new Set([
    ...Object.values(colors),
    ...Object.values(siteExtensions(css)),
    // Pure black and white are typography/ink, not palette entries, and appear in
    // every asset. Named here so the assertion does not demand a token for them.
    '#ffffff', '#000000',
  ]);
  const dir = join(webRepo, 'public');
  const offenders = [];
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.svg'))) {
    const text = readFileSync(join(dir, f), 'utf8');
    for (const m of text.matchAll(/#[0-9a-fA-F]{6}\b/g)) {
      const hex = m[0].toLowerCase();
      if (!known.has(hex)) offenders.push(`public/${f}: ${m[0]}`);
    }
  }
  if (offenders.length) {
    die(
      `brand asset(s) use a colour that is in no palette — neither Core's nor this ` +
        `site's declared extensions:\n` +
        [...new Set(offenders)].map((o) => `  • ${o}`).join('\n') +
        `\nPick the nearest token from ${relJson} (or declare it in ${relCss} as a site ` +
        `extension, with a reason), then re-run.`,
    );
  }
}

// ── write, or check ──────────────────────────────────────────────────────────
const currentJson = existsSync(jsonOut) ? readFileSync(jsonOut, 'utf8') : '';

if (check) {
  assertSvgPalette(nextCss);
  const stale = [];
  // Compare everything EXCEPT the per-run stamp, for the reason data-strip.jq exists:
  // generatedAt moves daily and the Core SHA moves on every unrelated Core commit, so
  // neither may turn this red on its own.
  const strip = (s) => {
    if (!s) return s;
    try {
      const o = JSON.parse(s);
      delete o.generatedAt;
      if (o.generatedFrom) delete o.generatedFrom.commit;
      return JSON.stringify(o, null, 2) + '\n';
    } catch {
      return s;
    }
  };
  if (strip(currentJson) !== strip(paletteJson)) stale.push(relJson);
  if (currentCss !== nextCss) stale.push(`${relCss} (${MARK_OPEN} block)`);

  if (!stale.length) {
    console.log(`[collect-palette] --check: ${relJson} and the ${MARK_OPEN} block are in step with ${SRC_REPO}/${SRC_PATH}.`);
    process.exit(0);
  }
  console.error(`[collect-palette] --check: STALE — ${stale.join(', ')}`);
  if (currentCss !== nextCss) {
    const a = currentCss.split('\n');
    const b = nextCss.split('\n');
    console.error(`\n--- committed ${relCss}\n+++ regenerated from ${SRC_REPO}/${SRC_PATH}`);
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      if (a[i] !== b[i]) {
        if (a[i] !== undefined) console.error(`-${a[i]}`);
        if (b[i] !== undefined) console.error(`+${b[i]}`);
      }
    }
  }
  console.error(`\nRun \`npm run palette\` and commit the result.`);
  process.exit(1);
}

writeFileSync(jsonOut, paletteJson);
writeFileSync(cssOut, nextCss);
// Assert AFTER writing, so the allowlist reflects the tokens just emitted.
assertSvgPalette(nextCss);

console.log(
  `[collect-palette] wrote ${relJson} (${Object.keys(colors).length} colours, ` +
    `${Object.keys(roles).length} roles, style ${parsed.style}) and ${BINDINGS.length} ` +
    `tokens into ${relCss}`,
);
