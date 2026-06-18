// The changelog page is derived straight from each repo's canonical CHANGELOG.md,
// parsed by scripts/collect-metrics.mjs into generated.json. There is no hand-kept
// mirror to drift any more: regenerate with `npm run metrics` after a repo's
// changelog changes. Category is a free string because repos use their own section
// names (Keep a Changelog's Added/Changed/Fixed/Security, plus Windows's themed
// groupings); the page tones the known ones and falls back to neutral.
import generated from './generated.json';

export interface ChangeGroup {
  category: string;
  items: string[];
}

export interface ChangelogEntry {
  repo: string;
  version: string;
  date?: string;
  summary?: string;
  groups: ChangeGroup[];
}

export const changelog: ChangelogEntry[] =
  (generated as { changelog?: ChangelogEntry[] }).changelog ?? [];
