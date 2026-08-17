// fleet-root.mjs — where the sibling dotfiles repos live, for the collectors that
// read them. Not an entrypoint; every other file in scripts/ is runnable, this is not.
//
// Extracted from collect-metrics.mjs and collect-snippets.mjs, which had grown
// byte-identical copies of this logic. They were duplicated deliberately — both files
// were in flight on separate branches at the time, and factoring out a shared module
// would have meant editing a file another session was actively rewriting. That reason
// expired when both landed; this is the follow-up, before "temporarily duplicated"
// became permanent by default.

import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';

// The default probe used to test whether a candidate directory IS the fleet. Core is
// the safe pick for the collectors that read it: the one repo their inputs can never
// stop naming. Collectors reading elsewhere pass their own — collect-corpus.mjs probes
// for `htpx` and collect-coverage.mjs for `dotfiles-Defense`, because a checkout can
// legitimately hold those without holding Core.
export const FLEET_SENTINEL = 'dotfiles-core';

/**
 * Resolve the fleet directory, in precedence order:
 *
 *   1. DOTFILES_ROOT, if set — an explicit answer always wins.
 *   2. Beside this checkout — the ordinary case, dotfiles-web sitting in the fleet dir.
 *   3. Beside the MAIN worktree — the case (2) cannot reach.
 *
 * Step 3 exists because a LINKED WORKTREE lives outside the fleet directory, so `..`
 * from it holds no repos at all. That is not an edge case: sharing one clone between
 * concurrent sessions is what let an unmerged CHANGELOG.md get published on 2026-08-16,
 * and the remedy everyone was moved onto is a per-session worktree. Without this step
 * the remedy breaks the collectors — a bare run from a worktree resolves NONE of the
 * fleet and exits 0 keeping the stale snapshot, which is the same silent staleness the
 * cleanliness preflight exists to prevent, arriving through a different door.
 *
 * `git rev-parse --git-common-dir` resolves to the MAIN worktree's .git even when run
 * from a linked one, so its grandparent is the fleet directory. In a normal clone it
 * resolves to our own .git and step 3 lands back on step 2's answer — hence the
 * `!== beside` guard, which makes this a no-op off the worktree path. Step 2 also
 * returns early whenever the fleet is beside us, so an ordinary clone never runs git.
 *
 * @param {string} webRepo  Absolute path to the dotfiles-web checkout.
 * @param {string} [sentinel=FLEET_SENTINEL] Repo name to probe for. Pass the repo
 *   THIS collector reads, not always Core: a checkout can hold htpx without Core,
 *   and probing for the wrong one would reject a directory that is in fact the fleet.
 * @returns {{ root: string, via: 'DOTFILES_ROOT' | 'siblings' | 'main worktree' }}
 *   `via` is reported so a caller can say when it reached outside its own checkout for
 *   inputs — that belongs in a build log rather than being inferred later from a
 *   surprising diff.
 */
export function resolveFleetRoot(webRepo, sentinel = FLEET_SENTINEL) {
  if (process.env.DOTFILES_ROOT) {
    return { root: resolve(process.env.DOTFILES_ROOT), via: 'DOTFILES_ROOT' };
  }

  const beside = resolve(webRepo, '..');
  if (existsSync(join(beside, sentinel))) return { root: beside, via: 'siblings' };

  try {
    const commonDir = execFileSync('git', ['-C', webRepo, 'rev-parse', '--git-common-dir'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    // --git-common-dir may answer relatively (a bare ".git"); resolve against webRepo.
    const mainWorktree = dirname(resolve(webRepo, commonDir));
    const fromMain = resolve(mainWorktree, '..');
    if (fromMain !== beside && existsSync(join(fromMain, sentinel))) {
      return { root: fromMain, via: 'main worktree' };
    }
  } catch {
    // No git, or not a checkout. Fall through — each caller's own missing-inputs check
    // reports it, with the diagnostics and strictness that caller already defines.
  }

  // Nothing found. Return the conventional answer so the caller's diagnostics name the
  // path a reader expects, rather than some deduced one. CI (which clones dotfiles-web
  // alone) lands here and keeps its current behaviour exactly.
  return { root: beside, via: 'siblings' };
}
