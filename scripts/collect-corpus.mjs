#!/usr/bin/env node
// collect-corpus.mjs — derive the red↔blue "purple" corpus from the sibling htpx
// repo and write it to src/data/corpus.json, which the /purple page renders.
//
// Why: the corpus (attacks paired with their detections, ATT&CK-tagged) is authored
// in dotgibson/htpx as entries/{red,blue}/*.md — the source of truth. Rather than
// hand-retype 50+ pairs here (they would rot the moment a round lands), parse the
// entry frontmatter and emit a structured snapshot the site consumes at build time.
//
//   node scripts/collect-corpus.mjs            # htpx is a sibling of this repo
//   DOTFILES_ROOT=/path/to/repos node scripts/collect-corpus.mjs
//
// Defensive, exactly like collect-metrics.mjs: if htpx isn't checked out (e.g. the
// Pages CI runner only clones dotfiles-web), leave the committed corpus.json untouched
// and exit 0 rather than zeroing it. Pass --strict (or STRICT=1) to make a missing
// htpx a HARD ERROR instead, so an "about to publish" run can't silently ship stale data.

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRepo = resolve(__dirname, '..');
const root = process.env.DOTFILES_ROOT ? resolve(process.env.DOTFILES_ROOT) : resolve(webRepo, '..');
const strict = process.argv.includes('--strict') || process.env.STRICT === '1';
const out = join(webRepo, 'src', 'data', 'corpus.json');

const htpx = join(root, 'htpx', 'entries');
// Require both colour dirs — a bare entries/ (or a partial checkout) takes the
// defensive path rather than crashing in readdirSync below.
const missing = !existsSync(join(htpx, 'red')) || !existsSync(join(htpx, 'blue'));
if (missing) {
  const msg = `collect-corpus: htpx entries/{red,blue} not found under ${htpx}`;
  if (strict) {
    console.error(`${msg} — refusing to ship stale corpus (--strict).`);
    process.exit(1);
  }
  console.warn(`${msg} — leaving committed corpus.json untouched.`);
  process.exit(0);
}

// Friendly platform grouping. Keyed by the entry's primary `platform:` tag; on-prem
// tags collapse into one group. Unknown tags fall back to a title-cased label.
const GROUPS = {
  windows: 'On-prem AD / Windows',
  linux: 'On-prem AD / Windows',
  network: 'On-prem AD / Windows',
  cloud: 'Cloud IAM (Entra · AWS · GCP)',
  okta: 'Okta',
  gws: 'Google Workspace',
  kubernetes: 'Kubernetes',
  github: 'GitHub Actions',
  gitlab: 'GitLab CI/CD',
  jenkins: 'Jenkins',
  harbor: 'Harbor registry',
  vault: 'HashiCorp Vault',
  terraform: 'Terraform Cloud',
  snowflake: 'Snowflake',
  cloudflare: 'Cloudflare edge',
  npm: 'npm registry',
  pypi: 'PyPI registry',
  slack: 'Slack',
};
// Display order for the groups (on-prem first, then cloud/SaaS by theme).
const ORDER = [
  'On-prem AD / Windows', 'Cloud IAM (Entra · AWS · GCP)', 'Okta', 'Google Workspace',
  'Kubernetes', 'GitHub Actions', 'GitLab CI/CD', 'Jenkins', 'Harbor registry',
  'HashiCorp Vault', 'Terraform Cloud', 'Snowflake', 'Cloudflare edge',
  'npm registry', 'PyPI registry', 'Slack',
];

function frontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const fm = m[1];
  const scalar = (k) => {
    const mm = fm.match(new RegExp(`^${k}:\\s*(.+?)\\s*$`, 'm'));
    return mm ? mm[1].trim() : null;
  };
  // Leading whitespace allowed: `platform:` is top-level but `techniques:` is
  // nested under the `attack:` block (indented).
  const list = (k) => {
    const mm = fm.match(new RegExp(`^\\s*${k}:\\s*\\[(.*?)\\]\\s*$`, 'm'));
    return mm ? mm[1].split(',').map((s) => s.trim()).filter(Boolean) : [];
  };
  const tactic = (fm.match(/tactic:\s*(TA\d+)/) || [])[1] || null;
  return {
    id: scalar('id'),
    title: scalar('title'),
    section: scalar('section'),
    phase: scalar('phase'),
    detection: scalar('detection'),
    pair: scalar('pair'),
    platform: list('platform'),
    tactic,
    techniques: list('techniques'),
  };
}

function load(colour) {
  const dir = join(htpx, colour);
  const map = {};
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
    const fmData = frontmatter(readFileSync(join(dir, f), 'utf8'));
    if (fmData && fmData.id) map[fmData.id] = fmData;
  }
  return map;
}

const red = load('red');
const blue = load('blue');

const pairs = [];
for (const r of Object.values(red)) {
  if (!r.pair || r.pair === 'null') continue;
  const b = blue[r.pair];
  if (!b) continue;
  const key = r.platform[0] || 'other';
  const group = GROUPS[key] || key.charAt(0).toUpperCase() + key.slice(1);
  pairs.push({
    id: r.id,
    attack: r.title,
    detection: b.title,
    group,
    phase: r.phase,
    tactic: r.tactic,
    techniques: r.techniques,
  });
}

// Stable order: by group (ORDER, then alpha), then by attack title.
const groupRank = (g) => {
  const i = ORDER.indexOf(g);
  return i === -1 ? ORDER.length : i;
};
pairs.sort((a, b) => groupRank(a.group) - groupRank(b.group) || a.group.localeCompare(b.group) || a.attack.localeCompare(b.attack));

const groups = [];
for (const p of pairs) {
  let g = groups.find((x) => x.label === p.group);
  if (!g) groups.push((g = { label: p.group, count: 0 }));
  g.count += 1;
}

const techniques = [...new Set(pairs.flatMap((p) => p.techniques))].sort();
const tactics = [...new Set(pairs.map((p) => p.tactic).filter(Boolean))].sort();

const corpus = {
  totalPairs: pairs.length,
  groupCount: groups.length,
  techniqueCount: techniques.length,
  tacticCount: tactics.length,
  groups,
  pairs,
};

writeFileSync(out, JSON.stringify(corpus, null, 2) + '\n');
console.log(
  `collect-corpus: wrote ${out} — ${pairs.length} pairs, ${groups.length} groups, ${techniques.length} techniques`,
);
