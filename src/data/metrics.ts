// Typed access to the source-derived numbers in generated.json.
// Regenerate with: node scripts/collect-metrics.mjs  (reads the sibling repos).
import generated from './generated.json';

export interface GeneratedMetrics {
  generatedAt: string;
  fleet: { publicRepos: number; layers: number; loadOrderStages: number };
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
}

export const metrics = generated as GeneratedMetrics;

// Package count for a repo card ("dotfiles-Kali" -> 28). Returns null when the
// repo ships no package list (e.g. the Windows host uses scoop/winget manifests).
export const packageCount = (repo: string): number | null =>
  metrics.packages[repo] ?? null;

// The curated headline stats for the homepage "by the numbers" strip. Each value
// is pulled from generated.json so it tracks the real repos.
export const headlineStats: { value: string; label: string; hint: string }[] = [
  { value: String(metrics.fleet.publicRepos), label: 'public repos', hint: 'one Core, vendored everywhere' },
  { value: String(metrics.fleet.layers), label: 'clean layers', hint: 'Core · OS-native · Role' },
  { value: String(metrics.core.sourcedModules), label: 'Core zsh modules', hint: 'one canonical load order' },
  { value: metrics.core.zshLoc.toLocaleString(), label: 'lines of Core zsh', hint: 'authored once, synced out' },
  { value: String(metrics.core.gitAliases), label: 'git aliases', hint: 'OMZ-style, in git.zsh' },
  { value: String(metrics.core.pinnedPlugins), label: 'SHA-pinned plugins', hint: 'no floating master clones' },
];
