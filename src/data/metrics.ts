// Typed access to the source-derived numbers in generated.json.
// Regenerate with: node scripts/collect-metrics.mjs  (reads the sibling repos).
import generated from './generated.json';
import { repos } from './repos';

export interface GeneratedMetrics {
  generatedAt: string;
  fleet: { publicRepos: number; layers: number; loadOrderStages: number };
  // Release channels for the version-switcher, derived from dotfiles-core's
  // CHANGELOG by collect-metrics.mjs and consumed in data/site.ts.
  releases?: { current: string; channels: string[] };
  core: {
    version: string | null;
    sourcedModules: number;
    zshLoc: number;
    gitAliases: number;
    pinnedPlugins: number;
    completions: number | null;
  };
  packages: Record<string, number>;
  ci: Record<string, boolean>;
  drift?: {
    coreVersion: string | null;
    repos: Record<
      string,
      {
        // The Core release/sha this repo VENDORS, from its core.lock stamp.
        ref: string | null;
        carried: string | null;
        // Host layer only: the Core ref its nvim/starship mirror was last synced
        // from. Provenance for two config files — NOT a vendored Core version, so
        // it is deliberately kept out of `ref`/`carried`, which drift compares.
        mirroredFrom?: string | null;
        status: DriftStatus;
      }
    >;
  };
}

// 'replicated' is not a drift verdict — it means the repo vendors no Core at all
// (the Windows host replicates it natively in PowerShell), so there is no carried
// version that could be current or behind.
export type DriftStatus = 'current' | 'behind' | 'unknown' | 'replicated';

export const metrics = generated as GeneratedMetrics;

// The host layer replicates Core natively instead of vendoring it — the same rule
// src/lib/fleet-status.ts encodes as `vendorsCore = layer === 'os' || layer === 'role'`.
// Derived from repos.ts (the fleet's source of truth for layers) so there is no second
// hardcoded repo name to keep in step. repos.ts imports nothing, so this cannot cycle.
const replicatesCore = new Set(repos.filter((r) => r.layer === 'host').map((r) => r.name));

// Vendoring drift for one consumer repo: which Core release it carries and whether
// that matches Core's current version. Defensive — an absent repo or a generated.json
// produced before this field existed degrades to 'unknown' (neutral), never throws.
//
// The host's 'replicated' is COERCED rather than trusted from generated.json: a
// snapshot written before collect-metrics.mjs learned this state labels the host
// 'behind' with a `ref` copied from its mirror stamp, which is precisely the false
// claim being fixed. Ignoring that stale `ref` means the host shows no version label
// until the data is regenerated, and `mirroredFrom` supplies it correctly afterwards.
// Once regenerated the coercion is a no-op.
export const driftFor = (
  repo: string
): { ref: string | null; status: DriftStatus; mirroredFrom: string | null } => {
  const d = metrics.drift?.repos?.[repo];
  if (replicatesCore.has(repo)) {
    return { ref: null, status: 'replicated', mirroredFrom: d?.mirroredFrom ?? null };
  }
  return { ref: d?.ref ?? null, status: d?.status ?? 'unknown', mirroredFrom: null };
};

// Package count for a repo card ("dotfiles-Kali" -> 28). Returns null when the
// repo ships no package list (e.g. the Windows host uses scoop/winget manifests).
export const packageCount = (repo: string): number | null =>
  metrics.packages[repo] ?? null;

// The curated headline stats for the homepage "by the numbers" strip. Each value
// is pulled from generated.json so it tracks the real repos.
export const headlineStats: { value: string; label: string; hint: string }[] = [
  { value: String(metrics.fleet.publicRepos), label: 'public repos', hint: 'one Core, vendored into all but the Windows host' },
  { value: String(metrics.fleet.layers), label: 'clean layers', hint: 'Core · OS-native · Role' },
  { value: String(metrics.core.sourcedModules), label: 'Core zsh modules', hint: 'one canonical load order' },
  { value: metrics.core.zshLoc.toLocaleString(), label: 'lines of Core zsh', hint: 'authored once, synced out' },
  { value: String(metrics.core.gitAliases), label: 'git aliases', hint: 'OMZ-style, in 25-git.zsh' },
  { value: String(metrics.core.pinnedPlugins), label: 'SHA-pinned plugins', hint: 'no floating master clones' },
];
