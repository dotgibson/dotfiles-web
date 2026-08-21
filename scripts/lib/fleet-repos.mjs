// fleet-repos.mjs — WHAT the fleet is, for the collectors that read it. Not an
// entrypoint; every other file in scripts/ is runnable, this and fleet-root.mjs
// are not.
//
// Deliberately separate from fleet-root.mjs, which answers WHERE the fleet is.
// The two have different blast radii and both are on data-freshness.yml's
// pull_request path filter for different reasons: fleet-root can repoint every
// collector at once, this one can change which repos a run demands. Merging them
// would blur that.
//
// The manifest this reads is also read by .github/actions/clone-fleet, which is
// the whole point: the list of repos CI clones and the list a collector requires
// are now the same list, so they cannot drift apart and disagree about whether a
// build should be red.

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Absolute path to the manifest. Resolved from this module, not the cwd. */
export const FLEET_MANIFEST = resolve(__dirname, '..', 'fleet-repos.txt');

/**
 * Parse scripts/fleet-repos.txt.
 *
 * Format is `<repo-name> <role>` per line, `#` comments and blank lines ignored
 * — the same shape as dotfiles-core's scripts/os-repos.txt, plus the role column
 * this repo needs because its consumers want different slices: the workflows
 * clone everything, collect-metrics.mjs wants Core separated from the ten it
 * counts, and htpx must stay out of that count entirely.
 *
 * Order is preserved, and for the `os` rows that matters: it is the order
 * generated.json's per-repo objects are keyed in.
 *
 * @returns {{ all: string[], core: string, os: string[], aux: string[] }}
 */
export function readFleetRepos() {
  const rows = readFileSync(FLEET_MANIFEST, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l, i) => {
      const [name, role] = l.split(/\s+/);
      if (!name || !role) {
        throw new Error(`${FLEET_MANIFEST}: line ${i + 1} is not "<repo-name> <role>": ${l}`);
      }
      if (!['core', 'os', 'aux'].includes(role)) {
        throw new Error(`${FLEET_MANIFEST}: unknown role "${role}" for ${name} (want core|os|aux)`);
      }
      return { name, role };
    });

  const core = rows.filter((r) => r.role === 'core').map((r) => r.name);
  // Exactly one, and it is the sentinel every collector's root probe leans on —
  // a manifest with none (or two) would make `core` undefined (or arbitrary)
  // downstream, which is worth an error here rather than a confusing bail later.
  if (core.length !== 1) {
    throw new Error(`${FLEET_MANIFEST}: expected exactly one core repo, found ${core.length}`);
  }

  return {
    all: rows.map((r) => r.name),
    core: core[0],
    os: rows.filter((r) => r.role === 'os').map((r) => r.name),
    aux: rows.filter((r) => r.role === 'aux').map((r) => r.name),
  };
}
