#!/usr/bin/env node
// collect-coverage.mjs — derive the ATT&CK detection-coverage snapshot from the sibling
// dotfiles-Defense repo and write it to src/data/coverage.json, which the /purple page
// renders beneath the corpus.
//
// Why: dotfiles-Defense's Sigma rules (detections/sigma/**/*.yml) are the source of truth
// for what the blue side actually detects. Each rule carries ATT&CK tactic tags
// (attack.<tactic>) and technique tags (attack.tXXXX[.YYY]) and a logsource. This is the
// same roll-up dotfiles-Defense ships as detections/navigator/COVERAGE.md (via
// gen-coverage.sh) — mirrored here in JS so the site shows live coverage without
// hand-retyping it. Three views: by ATT&CK tactic, by technique, by logsource.
//
//   node scripts/collect-coverage.mjs            # dotfiles-Defense is a sibling of this repo
//   DOTFILES_ROOT=/path/to/repos node scripts/collect-coverage.mjs
//
// Defensive, exactly like collect-corpus.mjs: if dotfiles-Defense isn't checked out (e.g.
// the Pages CI runner only clones dotfiles-web), leave the committed coverage.json
// untouched and exit 0 rather than zeroing it. Pass --strict (or STRICT=1) to make a
// missing sibling a HARD ERROR instead, so an "about to publish" run can't ship stale data.

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRepo = resolve(__dirname, '..');
const root = process.env.DOTFILES_ROOT ? resolve(process.env.DOTFILES_ROOT) : resolve(webRepo, '..');
const strict = process.argv.includes('--strict') || process.env.STRICT === '1';
const out = join(webRepo, 'src', 'data', 'coverage.json');

const sigma = join(root, 'dotfiles-Defense', 'detections', 'sigma');
if (!existsSync(sigma) || !statSync(sigma).isDirectory()) {
  const msg = `collect-coverage: dotfiles-Defense detections/sigma not found under ${sigma}`;
  if (strict) {
    console.error(`${msg} — refusing to ship stale coverage (--strict).`);
    process.exit(1);
  }
  console.warn(`${msg} — leaving committed coverage.json untouched.`);
  process.exit(0);
}

// ATT&CK enterprise tactics: tag slug -> [display name, TA id], in kill-chain order.
// Matching against this fixed set (not any attack.\w+) keeps reference URLs
// (attack.mitre.org) and technique tags (attack.tNNNN) out of the tactic tally —
// the same guard gen-coverage.sh uses.
const TACTICS = [
  ['reconnaissance', 'Reconnaissance', 'TA0043'],
  ['resource_development', 'Resource Development', 'TA0042'],
  ['initial_access', 'Initial Access', 'TA0001'],
  ['execution', 'Execution', 'TA0002'],
  ['persistence', 'Persistence', 'TA0003'],
  ['privilege_escalation', 'Privilege Escalation', 'TA0004'],
  ['defense_evasion', 'Defense Evasion', 'TA0005'],
  ['credential_access', 'Credential Access', 'TA0006'],
  ['discovery', 'Discovery', 'TA0007'],
  ['lateral_movement', 'Lateral Movement', 'TA0008'],
  ['collection', 'Collection', 'TA0009'],
  ['command_and_control', 'Command and Control', 'TA0011'],
  ['exfiltration', 'Exfiltration', 'TA0010'],
  ['impact', 'Impact', 'TA0040'],
];

// Walk detections/sigma/<dir>/*.yml (two levels, matching gen-coverage.sh's */*.yml glob).
function ruleFiles() {
  const files = [];
  for (const d of readdirSync(sigma)) {
    const dir = join(sigma, d);
    if (!statSync(dir).isDirectory()) continue;
    for (const f of readdirSync(dir)) {
      if (f.endsWith('.yml')) files.push({ dir: d, path: join(dir, f), stem: f.replace(/\.yml$/, '') });
    }
  }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

const techRe = /attack\.(t\d+(?:\.\d+)?)/gi;
const prodRe = /^\s*product:\s*(\S+)\s*$/gm;
const titleRe = /^title:/gm;

const tacTech = new Map(); // slug -> Set(technique)
const tacRules = new Map(); // slug -> Set(stem)
const techRules = new Map(); // technique -> Set(stem)
const dirRules = new Map(); // dir -> Set(stem)
const dirProd = new Map(); // dir -> Set(product)
let ruleCount = 0;
let documentCount = 0;

for (const { dir, path, stem } of ruleFiles()) {
  const text = readFileSync(path, 'utf8');
  ruleCount += 1;
  documentCount += (text.match(titleRe) || []).length;

  const techs = new Set([...text.matchAll(techRe)].map((m) => 'T' + m[1].slice(1).toUpperCase()));
  const tactics = TACTICS.map(([slug]) => slug).filter((slug) =>
    new RegExp(`attack\\.${slug}\\b`).test(text),
  );

  for (const t of techs) (techRules.get(t) ?? techRules.set(t, new Set()).get(t)).add(stem);
  for (const slug of tactics) {
    const ts = tacTech.get(slug) ?? tacTech.set(slug, new Set()).get(slug);
    for (const t of techs) ts.add(t);
    (tacRules.get(slug) ?? tacRules.set(slug, new Set()).get(slug)).add(stem);
  }
  (dirRules.get(dir) ?? dirRules.set(dir, new Set()).get(dir)).add(stem);
  for (const m of text.matchAll(prodRe)) (dirProd.get(dir) ?? dirProd.set(dir, new Set()).get(dir)).add(m[1]);
}

// Sort T1098 before T1098.001 before T1136.003: numeric on the base id, then the sub.
const techKey = (t) => {
  const [base, sub] = t.slice(1).split('.');
  return [Number(base), sub ? Number(sub) : -1];
};
const techSort = (a, b) => {
  const [ab, as] = techKey(a);
  const [bb, bs] = techKey(b);
  return ab - bb || as - bs;
};

const tactics = TACTICS.filter(([slug]) => tacRules.has(slug)).map(([slug, name, id]) => ({
  id,
  name,
  techniques: tacTech.get(slug).size,
  rules: tacRules.get(slug).size,
}));

const techniques = [...techRules.keys()].sort(techSort).map((t) => ({
  id: t,
  rules: techRules.get(t).size,
  ruleNames: [...techRules.get(t)].sort(),
}));

const logsources = [...dirRules.keys()].sort().map((d) => ({
  dir: d,
  products: [...(dirProd.get(d) ?? new Set())].sort(),
  rules: dirRules.get(d).size,
}));

const coverage = {
  ruleCount,
  documentCount,
  techniqueCount: techniques.length,
  tacticCount: tactics.length,
  logsourceCount: logsources.length,
  tactics,
  techniques,
  logsources,
};

writeFileSync(out, JSON.stringify(coverage, null, 2) + '\n');
console.log(
  `collect-coverage: wrote ${out} — ${ruleCount} rules, ${techniques.length} techniques, ${tactics.length} tactics, ${logsources.length} logsources`,
);
