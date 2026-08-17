#!/usr/bin/env node
// install-hooks.mjs — install this repo's local pre-commit guard into .git/hooks.
//
// Wired to `prepare`, so `npm install` sets it up and nobody has to be told it exists.
// Run it directly with `npm run hooks:install`.
//
// WHAT IT GUARDS. src/data/generated.json is derived from the sibling dotfiles repos'
// WORKING TREES, so a sibling parked on a feature branch or carrying uncommitted edits
// gets that unmerged work absorbed into the published site data. collect-metrics.mjs
// refuses to do that under --strict (which `npm run data` now passes), but the lenient
// path — a bare `npm run metrics` — still writes, with a warning. This hook is the
// backstop for exactly that case: it gates the COMMIT, which is the step that actually
// publishes, rather than the regeneration.
//
// This is the same shape as dotfiles-core's `blib_install_core_guard`, deliberately,
// including its three hard-won refusals (core.hooksPath, a pre-existing hook, a
// non-worktree). Two of its lessons are worth restating here because they are the
// difference between a guard and the appearance of one:
//
//   • A local hook protects exactly ONE machine. It is not the durable control — CI
//     is. See the `committed-data-provenance` job in data-freshness.yml, which asks
//     the same question of every PR, on every machine.
//   • Writing into .git/hooks when core.hooksPath is set is a silent no-op. Installing
//     "successfully" into a directory git ignores is worse than not installing, because
//     it buys confidence that is not backed by anything.
//
// NEVER FAILS THE CALLER. `prepare` runs during `npm install` / `npm ci`, including on
// the CI runners that build and deploy the site, so a problem here must degrade to a
// warning and exit 0. A repo that cannot take the hook still has to be able to install
// its dependencies.

import { writeFileSync, existsSync, readFileSync, mkdirSync, chmodSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MARKER = 'dotfiles-web-data-guard';
const warn = (m) => console.warn(`[install-hooks] ${m}`);

const git = (args) => {
  try {
    return execFileSync('git', ['-C', repoRoot, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
};

// Ask git rather than testing for a `.git` DIRECTORY: in a worktree or a submodule
// `.git` is a FILE, and a directory test would wrongly skip the install there. Which is
// not hypothetical for this fleet — sessions are being moved into `git worktree`
// checkouts precisely to stop them sharing one tree.
if (git(['rev-parse', '--is-inside-work-tree']) !== 'true') {
  warn(`${repoRoot} is not a git working tree — skipped.`);
  process.exit(0);
}

// A configured core.hooksPath makes git IGNORE .git/hooks entirely, so writing there
// would install nothing while reporting success. Say so and stop.
const hooksPath = git(['config', '--get', 'core.hooksPath']);
if (hooksPath) {
  warn(
    `this repo sets core.hooksPath (${hooksPath}), so git ignores .git/hooks — skipped. ` +
      `Install the guard there yourself, or the data check will not run locally.`
  );
  process.exit(0);
}

// --git-path resolves the REAL hooks dir, which for a worktree lives in the common git
// dir rather than beside the working copy. Returned relative to repoRoot, so absolutize.
const hooksRel = git(['rev-parse', '--git-path', 'hooks']);
if (!hooksRel) {
  warn('could not resolve the git hooks directory — skipped.');
  process.exit(0);
}
const hooksDir = isAbsolute(hooksRel) ? hooksRel : join(repoRoot, hooksRel);
const hookFile = join(hooksDir, 'pre-commit');

// Never clobber someone's own pre-commit hook. Ours is recognised by its marker, so
// re-running this (every npm install) rewrites ours and leaves anything else alone.
if (existsSync(hookFile)) {
  let existing = '';
  try {
    existing = readFileSync(hookFile, 'utf8');
  } catch {
    /* unreadable — treat as foreign and leave it alone */
  }
  if (!existing.includes(MARKER)) {
    warn(
      `a custom pre-commit hook already exists at ${hookFile} — left as-is. ` +
        `Add the check from scripts/install-hooks.mjs to it by hand if you want it.`
    );
    process.exit(0);
  }
}

// The hook is self-contained: it shells only to git and node, both of which are
// necessarily present (git is running it; node is what this repo is built with). It
// deliberately does NOT call a script under scripts/, so a checkout mid-refactor — or a
// branch where that script does not exist — cannot silently disarm the guard.
//
// It reads the STAGED blob (`git show :path`), never the working tree. Those differ
// exactly when it matters most: `npm run metrics`, `git add`, then edit or revert the
// file — the working copy would look innocent while the staged one ships.
const HOOK = `#!/usr/bin/env bash
# ${MARKER} — installed by scripts/install-hooks.mjs; do not edit by hand.
#
# Refuses to commit an src/data/generated.json that was derived from an unclean fleet
# (a sibling repo on a feature branch, or with uncommitted edits in a file the collector
# reads). Such a snapshot publishes unmerged work as fact — it has happened.
#
# Regenerate against a clean fleet:  npm run data      (fails loudly rather than absorbing)
# Sanctioned bypass:                 DOTFILES_ALLOW_DIRTY_DATA=1 git commit …
#                                    (or: git commit --no-verify)
set -u
[ -n "\${DOTFILES_ALLOW_DIRTY_DATA:-}" ] && exit 0

# Nothing staged for that file — nothing to say. --quiet exits 0 when there is no
# staged change and 1 when there is, which answers this without a pipeline or any
# tool beyond git itself. A staged DELETION also reports 1; that falls through to
# the git show below, which fails for a path absent from the index and exits 0.
git diff --cached --quiet -- src/data/generated.json 2>/dev/null && exit 0

staged="\$(git show :src/data/generated.json 2>/dev/null)" || exit 0
[ -z "\$staged" ] && exit 0

verdict="\$(printf '%s' "\$staged" | node -e '
let s = "";
process.stdin.on("data", (d) => (s += d)).on("end", () => {
  let j;
  try { j = JSON.parse(s); } catch { return console.log("SKIP\\tunparsable JSON"); }
  const g = j.generatedFrom;
  // A file predating the provenance stamp cannot be judged — do not block on it.
  if (!g || g.clean === undefined) return console.log("SKIP\\tno provenance stamp");
  if (g.clean === false) return console.log("BLOCK\\t" + (g.unclean || []).join("\\n\\t"));
  if (g.clean === null) return console.log("WARN\\tsome sibling could not be verified");
  console.log("OK\\t");
});
' 2>/dev/null)" || exit 0

case "\${verdict%%$'\\t'*}" in
  BLOCK)
    {
      printf '${MARKER}: refusing to commit site data derived from an unclean fleet.\\n\\n'
      printf '%s\\n' "\${verdict#*$'\\t'}" | sed 's/^/    /'
      printf '%s\\n' \\
        '' \\
        'That snapshot carries work from a sibling working tree that is not on its' \\
        'default branch, or not committed — so it would publish as fact something that' \\
        'exists on no branch of the source repo.' \\
        '' \\
        'Fix:      settle those repos, then re-run  npm run data' \\
        'Override: DOTFILES_ALLOW_DIRTY_DATA=1 git commit …   (or: git commit --no-verify)'
    } >&2
    exit 1
    ;;
  WARN)
    printf '${MARKER}: %s — provenance is incomplete, allowing the commit.\\n' \\
      "\${verdict#*$'\\t'}" >&2
    ;;
esac
exit 0
`;

try {
  mkdirSync(hooksDir, { recursive: true });
  writeFileSync(hookFile, HOOK);
  chmodSync(hookFile, 0o755);
  console.log(`[install-hooks] pre-commit guard installed (${MARKER}).`);
} catch (err) {
  // Deliberately not fatal — see the header. An unwritable hooks dir must not break
  // `npm ci` on a CI runner that only ever builds the site.
  warn(`could not write ${hookFile} (${err.message}) — skipped.`);
}
