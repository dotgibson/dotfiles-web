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
//
// BUT that lenient default is also how stale data silently ships: a local
// "I'm about to publish" run that can't see the fleet keeps the old snapshot and
// exits clean. --strict (or STRICT=1) makes a missing fleet a HARD ERROR (exit 1)
// instead — regenerate against the real repos, or fail loud.
//
// A missing fleet is not the only way this ships fiction, though. Everything below
// is read from the siblings' WORKING TREES, so a repo parked on a feature branch or
// carrying uncommitted edits gets that unmerged work absorbed into generated.json
// and published as fact. See the fleet-cleanliness preflight below, which --strict
// also gates.
//
// WHICH MODE YOU GET. `npm run data` — the publish path, and what CI runs — passes
// --strict for you, so neither hazard depends on anyone remembering a flag. Running
// this script bare (or `npm run metrics`) stays lenient and only WARNS, which is the
// right default for an exploratory run but is exactly how the 2026-08-16 incident
// shipped; `npm run data:lenient` is the whole pipeline in that mode.

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveFleetRoot } from './lib/fleet-root.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRepo = resolve(__dirname, '..');
const core = 'dotfiles-core';


const { root, via: rootVia } = resolveFleetRoot(webRepo);
if (rootVia === 'main worktree') {
  // Say so. Silently reaching outside this checkout for inputs is the kind of thing
  // that should appear in a build log, not be inferred later from a surprising diff.
  console.log(`[collect-metrics] running from a linked worktree — reading the fleet at ${root}`);
}
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

const osRepos = [
  'dotfiles-MacBook',
  'dotfiles-Windows',
  'dotfiles-Kali',
  'dotfiles-Defense',
  'dotfiles-Fedora',
  'dotfiles-Arch',
  'dotfiles-Debian',
  'dotfiles-openSUSE',
  'dotfiles-Alpine',
  'dotfiles-Gentoo',
];

// Bail (without overwriting the committed snapshot) unless the WHOLE fleet is
// present. A partial checkout would silently commit under-counted metrics — the
// opposite of this script's "tracks the real repos" promise. The Core zsh/ tree
// must exist too, since every Core metric is read from it.
const strict = process.argv.includes('--strict') || process.env.STRICT === '1';
const missing = [core, ...osRepos].filter((r) => !has(r));
const coreZshMissing = has(core) && !existsSync(join(repoPath(core), 'zsh'));
if (missing.length || coreZshMissing) {
  const why = missing.length ? `missing repos: ${missing.join(', ')}` : `${core}/zsh not found`;
  const tail =
    `Check out the full fleet beside this repo, or set DOTFILES_ROOT to point at it.`;
  if (strict) {
    // Publish path: refuse to leave a possibly-stale snapshot in place silently.
    console.error(
      `[collect-metrics] STRICT: ${why} under ${root} — cannot regenerate ` +
        `${relative(webRepo, out)}. ${tail}`
    );
    process.exit(1);
  }
  console.warn(
    `[collect-metrics] ${why} under ${root} — keeping the committed ` +
      `${relative(webRepo, out)} as-is. ${tail} (pass --strict to fail instead.)`
  );
  process.exit(0);
}

// ── Fleet-cleanliness preflight ─────────────────────────────────────────────
// Everything this script reads comes from the siblings' working trees, never from
// git. So whatever is checked out — a feature branch, a half-finished edit, a merge
// conflict — IS the input. On 2026-08-16 that shipped: dotfiles-core sat on
// fix/tpm-clone-failure-reporting with uncommitted CHANGELOG.md edits, and an
// `npm run metrics` run published a changelog entry that exists nowhere on Core's
// main. It was caught by hand, which is not a control.
//
// WHY THIS LIVES HERE AND NOT IN A PRE-SCRIPT. The obvious alternative — a separate
// scripts/preflight-fleet.mjs wired into `npm run data` — keeps this file free of
// child_process, and it is the wrong call for three reasons:
//
//   1. It does not fix the bug, it shrinks it. A separate process finishes before
//      this one starts reading, so the tree can still move in between. That is the
//      same time-of-check/time-of-use gap that made the "just survey the fleet at
//      session start" habit useless: two sessions ran `git status` across the fleet,
//      both got a clean bill for dotfiles-core, and the tree moved underneath them
//      before the collector ran — within one session the sweep fully inverted
//      (dotfiles-core main/clean -> feature/dirty while dotfiles-MacBook went the
//      other way). A TOCTOU bug is only closed by moving the check next to the read.
//   2. It would have missed the actual incident. The run that published the phantom
//      entry was `npm run metrics`, not `npm run data` — a pre-script on the
//      aggregate target does not cover the command that caused this.
//   3. The purity it protects is already gone. collect-corpus.mjs and
//      collect-coverage.mjs both shell out to git for their provenance stamps, so
//      child_process in a collector is this repo's existing pattern, not a new
//      design axis. And a separate process could not stamp generatedFrom.repos
//      below — provenance has to be recorded by whoever does the reading.
//
// This only bites LOCAL runs. fleet-sync.yml and data-freshness.yml's derived-data
// job clone fresh into a temp root, and deploy.yml's pinned build does too, so CI is
// structurally immune; the gap being closed is the human/agent publish path.
const gitIn = (dir, args) => {
  try {
    return execFileSync('git', ['-C', dir, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null; // not a git checkout, or no git on PATH
  }
};

// `git status --porcelain -z` emits "XY <path>\0" per entry, with rename/copy
// entries followed by a second NUL-terminated field holding the source path. -uall
// expands untracked directories to individual files, which matters: an untracked
// zsh/NN-new.zsh moves sourcedModules and zshLoc just as surely as a tracked edit.
function changedPaths(z) {
  const fields = z.split('\0').filter(Boolean);
  const paths = [];
  for (let i = 0; i < fields.length; i++) {
    const code = fields[i].slice(0, 2);
    paths.push(fields[i].slice(3));
    if (code[0] === 'R' || code[0] === 'C') i++; // skip the rename/copy source
  }
  return paths;
}

// Which working-tree paths can actually reach generated.json. A dirty README or a
// half-written test in a sibling repo cannot move a single number here, and failing
// a publish over one trains people to pass --no-verify at the numbers that matter.
// Kept as an explicit list of what the reads below touch, so it is auditable against
// them rather than being a vague "src/-ish" heuristic.
//
// Scoped PER REPO, because the same path is load-bearing in one repo and inert in
// another: zsh/ is where every core.* metric comes from in Core, while an OS repo's
// zsh/os.zsh is never read here — treating it as contaminating would block publishes
// over the ordinary business of editing an OS layer.
const READS_EVERYWHERE = [
  /^CHANGELOG\.md$/, // changelog + feed (+ release channels, in Core)
  /^install\//, // packages.txt, offensive-packages.txt
  /^(macos\/)?Brewfile$/, // macOS package counts
  /^\.github\/workflows\//, // the ci[] flags
];
const READS_PER_REPO = {
  [core]: [
    /^core\.version$/, // the Core version string
    /^zsh\//, // sourcedModules, zshLoc, gitAliases, pinnedPlugins, completions
  ],
  // The host repo replicates Core rather than vendoring it, so it has no core.lock —
  // its mirror stamp is the only extra file read from it (see the drift block below).
  'dotfiles-Windows': [/^nvim\/\.core-ref$/],
};
// The fallback: every repo without an entry above is a vendoring OS repo, and the
// only extra file read from one is its Core pin.
const VENDORING_LOCK = [/^core\.lock$/];
const readsOf = (repo) => [...READS_EVERYWHERE, ...(READS_PER_REPO[repo] ?? VENDORING_LOCK)];
const feedsTheCollector = (repo, p) => readsOf(repo).some((re) => re.test(p));

function repoState(name) {
  const dir = repoPath(name);
  const head = gitIn(dir, ['rev-parse', 'HEAD']);
  if (head == null) return { name, tracked: false, commit: null, branch: null, changed: [] };
  const abbrev = (gitIn(dir, ['rev-parse', '--abbrev-ref', 'HEAD']) || '').trim();
  // A detached HEAD abbreviates to the literal "HEAD". Recorded as null branch and
  // deliberately NOT treated as a problem: it is a committed, addressable state that
  // the provenance stamp pins exactly, and it is how deploy.yml builds a pinned
  // release (`git clone --depth 1 --branch <tag>` lands detached at the tag). Failing
  // on it would redden every release build to catch nothing.
  const branch = abbrev === 'HEAD' ? null : abbrev;
  const defaultBranch =
    (gitIn(dir, ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']) || '')
      .trim()
      .replace(/^origin\//, '') || null;
  return {
    name,
    tracked: true,
    commit: head.trim(),
    branch,
    defaultBranch,
    changed: changedPaths(gitIn(dir, ['status', '--porcelain', '-z', '-uall']) ?? ''),
  };
}

// Branch-vs-default is a blunt proxy for "carries unmerged work", and intentionally
// so: the precise question (does this branch's committed content differ from the
// default branch in a path the collector reads?) needs an up-to-date origin/main and
// gets a wrong answer from a stale one. The blunt check has no such failure mode.
function branchProblem(s) {
  if (s.branch == null) return null; // detached — see above
  // No origin/HEAD (a clone that never set it) — fall back to the conventional names
  // rather than declaring every repo off-default.
  const def = s.defaultBranch ?? (['main', 'master'].includes(s.branch) ? s.branch : 'main');
  return s.branch === def ? null : `on branch '${s.branch}' (default: '${def}')`;
}

const fleetState = [core, ...osRepos].map(repoState);
const unverifiable = fleetState.filter((s) => !s.tracked).map((s) => s.name);
const unclean = [];
const dirtyElsewhere = [];
for (const s of fleetState) {
  if (!s.tracked) continue;
  const relevant = s.changed.filter((p) => feedsTheCollector(s.name, p));
  const reasons = [branchProblem(s)].filter(Boolean);
  if (relevant.length) {
    const shown = relevant.slice(0, 4).join(', ');
    const more = relevant.length > 4 ? ` (+${relevant.length - 4} more)` : '';
    reasons.push(`uncommitted changes to ${shown}${more}`);
  } else if (s.changed.length) {
    dirtyElsewhere.push(s.name);
  }
  if (reasons.length) unclean.push(`${s.name} — ${reasons.join('; ')}`);
}

if (unclean.length) {
  const why =
    `the fleet is not publish-clean, so unmerged work would be read as fact:\n` +
    unclean.map((l) => `  • ${l}`).join('\n');
  const tail =
    `Commit, stash, or switch those repos back to their default branch, then ` +
    `re-run. (Only paths this collector actually reads are counted — see readsOf().)`;
  if (strict) {
    console.error(`[collect-metrics] STRICT: ${why}\n${tail}`);
    process.exit(1);
  }
  console.warn(
    `[collect-metrics] WARNING: ${why}\n${tail} (pass --strict to fail instead.)\n` +
      `Proceeding — the state above is recorded in generatedFrom.repos.`
  );
}
if (dirtyElsewhere.length) {
  console.log(
    `[collect-metrics] note: local changes in ${dirtyElsewhere.join(', ')}, but none ` +
      `in a path this collector reads — not treated as a problem.`
  );
}
if (unverifiable.length) {
  // A source that is not a git checkout is legitimate (a tarball, a vendored copy) —
  // collect-corpus.mjs tolerates the same and stamps a null commit. But if NOTHING is
  // verifiable the gate is not lenient, it is absent, and --strict would be advertising
  // a guarantee it cannot make — so that case is fatal on the publish path.
  const why =
    `cannot verify ${unverifiable.join(', ')} — not a git checkout (or git is not on PATH)`;
  if (strict && unverifiable.length === fleetState.length) {
    console.error(
      `[collect-metrics] STRICT: ${why}. No repo in the fleet can be checked, so the ` +
        `cleanliness gate cannot run at all. Point DOTFILES_ROOT at git checkouts, or ` +
        `drop --strict and accept unverified provenance.`
    );
    process.exit(1);
  }
  console.warn(`[collect-metrics] ${why} — its provenance stamp will be null.`);
}

// ── Core metrics ────────────────────────────────────────────────────────────
const coreDir = repoPath(core);
const zshDir = join(coreDir, 'zsh');
const zshFiles = readdirSync(zshDir).filter((f) => f.endsWith('.zsh'));
// Resolve a Core zsh fragment by its name, tolerant of the v4 numbered-fragment rename:
// match the pre-v4 bare name (git.zsh) OR the v4 numbered form (NN-git.zsh). Discovering
// by suffix means a future renumber can't silently break regeneration; a missing fragment
// is a HARD, explicit error rather than a raw ENOENT deep in the metrics.
const readFragment = (base) => {
  const hit = zshFiles.find((f) => f === base || f.endsWith(`-${base}`));
  if (!hit) throw new Error(`collect-metrics: no Core zsh fragment for "${base}" (looked for ${base} or NN-${base}) in ${zshDir}`);
  return readFileSync(join(zshDir, hit), 'utf8');
};
// "Sourced modules" = the numbered fragment chain the loader globs (zsh/NN-name.zsh),
// i.e. every zsh/*.zsh except the loader itself (which sources them); os/local live in
// the OS repos.
const sourcedModules = zshFiles.filter((f) => f !== 'loader.zsh').length;
const zshLoc = zshFiles.reduce(
  (n, f) => n + readFileSync(join(zshDir, f), 'utf8').split('\n').length,
  0
);
const gitAliases = (readFragment('git.zsh').match(/^\s*alias /gm) || []).length;
const plugins = readFragment('plugins.zsh');
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

// Map a change line to a coarse "kind" so the Diff/Update Feed can highlight and
// filter (design §2.2). Two honest, build-time signals: an explicit
// Conventional-Commits verb if the line carries one, else a keyword scan, else the
// Keep a Changelog category as fallback. Deterministic, no network. Order matters —
// the first match wins, so the high-signal kinds (security, perf) are checked first.
const CC_KIND = {
  perf: 'perf',
  feat: 'feature',
  fix: 'fix',
  refactor: 'config',
  chore: 'config',
  build: 'config',
  docs: 'config',
  style: 'config',
  security: 'security',
};
const KIND_RULES = [
  { kind: 'security', re: /\b(security|cve|vuln\w*|secret|credential|exploit|sanitiz\w*|hardening)\b/i },
  { kind: 'perf', re: /\b(perf\w*|faster|speed\w*|latency|startup|benchmark\w*|lazy|defer\w*|cache[ds]?|optimi[sz]\w*)\b/i },
  { kind: 'fix', re: /\b(fix\w*|bug\w*|regression|broken|correct\w*|guard|workaround)\b/i },
  { kind: 'config', re: /\b(config\w*|manifest|load order|refactor\w*|rename[ds]?|restructur\w*|default[s]?|setting[s]?|option[s]?)\b/i },
  { kind: 'feature', re: /\b(add\w*|feat\w*|introduce[ds]?|new|support[s]?|implement\w*)\b/i },
];
const CATEGORY_KIND = {
  Added: 'feature',
  Changed: 'config',
  Fixed: 'fix',
  Security: 'security',
  Removed: 'config',
  Deprecated: 'config',
};
function classify(text, category) {
  const cc = text.match(/^([a-z]+)(?:\([^)]*\))?!?:/i);
  if (cc && CC_KIND[cc[1].toLowerCase()]) return CC_KIND[cc[1].toLowerCase()];
  for (const r of KIND_RULES) if (r.re.test(text)) return r.kind;
  return CATEGORY_KIND[category] || 'other';
}

// How many version blocks to surface per repo: the newest Unreleased (when it has
// content) plus the most recent releases, so the page shows real release history
// instead of only a perpetual "Unreleased" section.
//
// The cap counts RELEASES ONLY, which is what that sentence has always described but
// not what the code did (#142). Counting Unreleased as one of the three meant a single
// unreleased bullet evicted a whole release: dotfiles-core's one-item Unreleased pushed
// v4.10.0 and its 64 entries off /changelog and out of the feed, an 854-line deletion
// that reads as ordinary regenerated data in a refresh PR. That inverts the stated
// purpose — an Unreleased section REDUCED the real release history rather than
// accompanying it.
const MAX_VERSIONS_PER_REPO = 3; // released blocks
const MAX_UNRELEASED_PER_REPO = 1; // plus the Unreleased section, when it has content

// A release heading is "## [vX.Y.Z]" (a leading v is optional, as deriveReleases()
// also allows). Anything else — canonically the single "## [Unreleased]" at the top —
// is not a release and so does not consume a release slot.
const RELEASE_VERSION = /^v?\d+\.\d+\.\d+$/;

// Parse one "## [version] - date" block — lines[start..end) — into an entry.
function parseBlock(name, lines, start, end) {
  // Heading: "## [Unreleased] — suffix" or "## [vX.Y.Z] - 2026-01-02".
  const head = lines[start].match(/^##\s+\[([^\]]+)\]\s*(?:[-–—]\s*(.*))?$/);
  const version = head ? head[1].trim() : 'Unreleased';
  let suffix = head && head[2] ? head[2].trim() : '';
  let date;
  if (/^\d{4}-\d{2}-\d{2}$/.test(suffix)) {
    date = suffix;
    suffix = '';
  }

  const block = lines.slice(start + 1, end);
  const groups = [];
  const pre = []; // prose before the first ### becomes the summary
  let cur = null;
  let buf = null; // lines of the item currently being built
  let sawCategory = false;
  const flush = () => {
    if (cur && buf) {
      const text = cleanInline(buf.join(' '));
      cur.items.push({ text, kind: classify(text, cur.category) });
    }
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

  const summary = [suffix, cleanInline(pre.join(' '))].filter(Boolean).join(' — ');
  return {
    repo: name,
    version,
    date,
    summary: summary || undefined,
    groups: groups.filter((g) => g.items.length),
  };
}

// Up to MAX_VERSIONS_PER_REPO non-empty RELEASE blocks from a repo's CHANGELOG.md,
// newest first, plus up to MAX_UNRELEASED_PER_REPO leading Unreleased block. Repos
// without a CHANGELOG.md are skipped.
function parseChangelog(name) {
  const file = join(repoPath(name), 'CHANGELOG.md');
  if (!existsSync(file)) return [];
  const lines = readFileSync(file, 'utf8').split('\n');
  const heads = [];
  for (let j = 0; j < lines.length; j++) if (/^##\s+\[.+\]/.test(lines[j])) heads.push(j);
  const entries = [];
  let releases = 0;
  let unreleased = 0;
  for (let h = 0; h < heads.length && releases < MAX_VERSIONS_PER_REPO; h++) {
    const entry = parseBlock(name, lines, heads[h], heads[h + 1] ?? lines.length);
    if (!entry.groups.length) continue; // an empty section is not history
    if (RELEASE_VERSION.test(entry.version)) {
      releases += 1;
    } else {
      // Only BEFORE the first release, and only so many: Keep a Changelog puts the one
      // Unreleased section at the top, so a non-semver heading appearing later is a
      // typo or a stray section, and letting those through would quietly raise the cap
      // for the repo — the same "one file exempted from the rule" shape as #139.
      if (releases > 0 || unreleased >= MAX_UNRELEASED_PER_REPO) continue;
      unreleased += 1;
    }
    entries.push(entry);
  }
  return entries;
}

const changelog = [core, ...osRepos].filter(has).flatMap(parseChangelog);

// Flat cross-repo projection for the Diff/Update Feed (design §2.3): one entry per
// change, newest first, each carrying its repo/version/kind. `core: true` marks a
// change authored in Core — it fans out to every OS repo, the feed's headline fact.
// Undated blocks (an Unreleased section) float to the top.
const feed = changelog
  .flatMap((e) =>
    e.groups.flatMap((g) =>
      g.items.map((it) => ({
        repo: e.repo,
        version: e.version,
        date: e.date,
        category: g.category,
        kind: it.kind,
        text: it.text,
        core: e.repo === core,
      }))
    )
  )
  .sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return -1;
    if (!b.date) return 1;
    return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
  });

// ── Vendoring drift: which Core RELEASE each consumer carries vs core.version ──
// File-only (no git), matching this script's "read the repos" model: each vendoring
// repo stamps core.lock (core_version/core_tag/core_sha). "current" = same release as
// Core now; "behind" = an older one; "unknown" = no release recorded yet.
//
// dotfiles-Windows is NOT a vendoring repo: it has no core/ subtree and replicates the
// host config natively in PowerShell, mirroring only nvim/ and starship.toml. Its
// nvim/.core-ref stamp records which Core tag that MIRROR was last synced from — real
// provenance, but a different fact from "the Core release this repo vendors". Folding
// it into `carried` made Windows compare against core.version and render as
// "behind — run a sync", advising a `git subtree pull` it cannot perform. It gets
// status "replicated" and reports the mirror stamp separately as `mirroredFrom`.
function readKv(file, key) {
  if (!existsSync(file)) return null;
  const m = readFileSync(file, 'utf8').match(new RegExp(`^\\s*${key}\\s*=\\s*(.+?)\\s*$`, 'm'));
  return m ? m[1] : null;
}
const stripV = (s) => (s || '').replace(/^v/, '');
// A `git describe` value ("vX.Y.Z-N-gabc1234") records N commits PAST the tag —
// which is what a mirror synced from a branch tip between releases carries. Strip
// that suffix so drift compares and labels by the release name: without it, such a
// stamp never equals coreVersion (always reads "behind") and shows an overlong,
// SHA-suffixed diagram label. A clean tag ("v3.2.0") is unaffected.
const stripDescribe = (s) => (s || '').replace(/-\d+-g[0-9a-f]+$/, '');
const driftRepos = {};
for (const name of osRepos) {
  // The host repo replicates Core rather than vendoring it, so it has no vendoring
  // drift to report — only the tag its nvim/starship mirror was last synced from.
  // Absence of that stamp still means "replicated", never "unknown": a missing mirror
  // ref does not turn Windows into a repo that carries Core.
  if (name === 'dotfiles-Windows') {
    const cr = join(repoPath(name), 'nvim', '.core-ref');
    const tag = stripDescribe(readKv(cr, 'tag'));
    const commit = readKv(cr, 'commit');
    driftRepos[name] = {
      ref: null,
      carried: null,
      mirroredFrom: tag || (commit ? commit.slice(0, 12) : null),
      status: 'replicated',
    };
    continue;
  }
  const lock = join(repoPath(name), 'core.lock');
  const carried = readKv(lock, 'core_version');
  const tag = stripDescribe(readKv(lock, 'core_tag'));
  const sha = readKv(lock, 'core_sha');
  const ref = tag || (sha ? sha.slice(0, 12) : null);
  const status =
    carried == null || coreVersion == null
      ? 'unknown'
      : carried === coreVersion
        ? 'current'
        : 'behind';
  driftRepos[name] = { ref, carried, status };
}

// ── Release channels for the docs version-switcher (derived from the fleet) ──
// dotfiles-core's CHANGELOG version headers are the canonical release list; the
// switcher offers the newest few releases plus the rolling 'main'. Cutting a
// release and regenerating this file updates the switcher automatically, so
// src/data/site.ts never hand-maintains a version list. Degrades to main-only
// when core has no tagged releases yet.
const MAX_RELEASE_CHANNELS = 3;
function deriveReleases() {
  const file = join(coreDir, 'CHANGELOG.md');
  if (!existsSync(file)) return { current: 'main', channels: ['main'] };
  const tags = [];
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^##\s+\[(v\d+\.\d+\.\d+)\]/); // released headers only (skip [Unreleased])
    if (m && !tags.includes(m[1])) tags.push(m[1]); // CHANGELOG is newest-first
  }
  if (!tags.length) return { current: 'main', channels: ['main'] };
  return { current: tags[0], channels: [...tags.slice(0, MAX_RELEASE_CHANNELS), 'main'] };
}
const releases = deriveReleases();

// Provenance stamp, same rationale as corpus.json / coverage.json but per-repo, since
// this file's figures come from eleven sources rather than one. Until now generated.json
// carried only a day-granular generatedAt, so a snapshot taken from a dirty tree was
// indistinguishable from a clean one after the fact — the 2026-08-16 incident left no
// trace in the file at all. `dirty` records whether a COLLECTOR-RELEVANT path was
// modified, i.e. exactly the condition the preflight warns about, so a snapshot
// published over that warning says so in its own data.
const generatedFrom = {
  // The preflight's VERDICT, not just its raw inputs, so the file carries its own
  // indictment and a reader (or a hook) needs no second opinion:
  //   true  — the preflight was satisfied
  //   false — regenerated over a warning; `unclean` says which repos and why
  //   null  — no problems found, but some repo could not be verified (a non-git
  //           source), which is not a failure and is not a clean bill either
  //
  // Recording the verdict is what makes this gateable. Per-repo `dirty` alone is not
  // enough: a sibling sitting on a feature branch whose edits are COMMITTED has a
  // clean working tree (dirty: false) while its unmerged content is every bit as
  // contaminating. The 2026-08-16 incident had both conditions at once, which is
  // exactly the sort of coincidence that hides a hole like that.
  clean: unclean.length ? false : unverifiable.length ? null : true,
  ...(unclean.length ? { unclean } : {}),
  repos: Object.fromEntries(
    fleetState.map((s) => [
      s.name,
      s.tracked
        ? {
            commit: s.commit,
            branch: s.branch, // null when detached
            // Emitted, not just used for the verdict: `branch` alone is not readable
            // after the fact — "on 'release'" only means something next to what this
            // repo's default IS. Also what makes the two stamps one shape, so a reader
            // (or a jq strip) can treat generated.json and snippets.json alike.
            defaultBranch: s.defaultBranch, // null when origin/HEAD is unset
            dirty: s.changed.some((p) => feedsTheCollector(s.name, p)),
          }
        : // Unverifiable — not a git checkout. Same four keys with nulls rather than a
          // shorter object, so a consumer reads nulls instead of probing for keys.
          { commit: null, branch: null, defaultBranch: null, dirty: null },
    ])
  ),
};

const data = {
  generatedAt: new Date().toISOString().slice(0, 10),
  generatedFrom,
  fleet: {
    publicRepos,
    layers: 3,
  },
  releases,
  drift: { coreVersion, repos: driftRepos },
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
  feed,
};

writeFileSync(out, JSON.stringify(data, null, 2) + '\n');
console.log(`[collect-metrics] wrote ${relative(webRepo, out)}`);
const { changelog: cl, ...rest } = data;
console.log(JSON.stringify(rest, null, 2));
console.log(
  `[collect-metrics] changelog: ${cl.length} version block(s) — ` +
    cl.map((e) => `${e.repo}@${e.version} (${e.groups.reduce((n, g) => n + g.items.length, 0)} items)`).join(', ')
);
