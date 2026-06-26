// The changelog + Diff/Update Feed are derived straight from each repo's canonical
// CHANGELOG.md, parsed by scripts/collect-metrics.mjs into generated.json. There is
// no hand-kept mirror to drift: regenerate with `npm run metrics` after a repo's
// changelog changes. Category is a free string because repos use their own section
// names (Keep a Changelog's Added/Changed/Fixed/Security, plus Windows's themed
// groupings); each item also carries a build-time `kind` for the feed's highlight +
// filter (see classify() in collect-metrics.mjs).
import generated from './generated.json';

// Coarse semantic class for a change line — drives the feed's filter chips, badges,
// and the perf/security highlight rails.
export type ChangeKind = 'perf' | 'feature' | 'fix' | 'config' | 'security' | 'other';

export interface ChangeItem {
  text: string;
  kind: ChangeKind;
}

export interface ChangeGroup {
  category: string;
  items: ChangeItem[];
}

export interface ChangelogEntry {
  repo: string;
  version: string;
  date?: string;
  summary?: string;
  groups: ChangeGroup[];
}

// One entry per change, newest first, flattened across every repo. `core` marks a
// change authored in Core — it ships to every OS repo on the next subtree pull.
export interface FeedItem {
  repo: string;
  version: string;
  date?: string;
  category: string;
  kind: ChangeKind;
  text: string;
  core: boolean;
}

// Every known kind — used to validate untrusted/older JSON before indexing kindMeta.
const ALL_KINDS: ChangeKind[] = ['perf', 'feature', 'fix', 'config', 'security', 'other'];
const isKind = (k: unknown): k is ChangeKind =>
  typeof k === 'string' && (ALL_KINDS as string[]).includes(k);

// Backward-compat: tolerate an older generated.json whose items are bare strings,
// and defensively coerce malformed objects (missing text / unknown kind) so the
// page can never throw indexing kindMeta[item.kind].
function normItem(it: unknown): ChangeItem {
  if (typeof it === 'string') return { text: it, kind: 'other' };
  const o = (it ?? {}) as Record<string, unknown>;
  return {
    text: typeof o.text === 'string' ? o.text : '',
    kind: isKind(o.kind) ? o.kind : 'other',
  };
}

const rawChangelog = (generated as { changelog?: ChangelogEntry[] }).changelog ?? [];
export const changelog: ChangelogEntry[] = rawChangelog.map((e) => ({
  ...e,
  groups: e.groups.map((g) => ({ ...g, items: g.items.map(normItem) })),
}));

// Newest-first; undated (Unreleased) blocks float to the top. Mirrors the sort in
// collect-metrics.mjs so a derived fallback matches the precomputed feed's order.
const byDateDesc = (a: FeedItem, b: FeedItem) => {
  if (!a.date && !b.date) return 0;
  if (!a.date) return -1;
  if (!b.date) return 1;
  return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
};

// Prefer the precomputed feed; if an older JSON lacks it, derive it from changelog
// AND apply the same sort so the reverse-chronological page renders correctly.
const rawFeed = (generated as { feed?: FeedItem[] }).feed;
export const feed: FeedItem[] =
  rawFeed ??
  changelog
    .flatMap((e) =>
      e.groups.flatMap((g) =>
        g.items.map((it) => ({
          repo: e.repo,
          version: e.version,
          date: e.date,
          category: g.category,
          kind: it.kind,
          text: it.text,
          core: e.repo === 'dotfiles-core',
        }))
      )
    )
    .sort(byDateDesc);

// Display metadata for each kind: chip/badge label + the tone token (maps to the
// global .tone-* colour classes). Centralised so the page and chips stay in step.
export const kindMeta: Record<ChangeKind, { label: string; tone: string }> = {
  perf: { label: 'Perf', tone: 'green' },
  feature: { label: 'Feature', tone: 'blue' },
  fix: { label: 'Fix', tone: 'cyan' },
  config: { label: 'Config', tone: 'purple' },
  security: { label: 'Security', tone: 'red' },
  other: { label: 'Change', tone: 'muted' },
};

// The kinds actually present in the feed, in a stable display order — drives which
// filter chips render (no empty chips).
const KIND_ORDER: ChangeKind[] = ['perf', 'feature', 'fix', 'config', 'security', 'other'];
export const presentKinds: ChangeKind[] = KIND_ORDER.filter((k) => feed.some((f) => f.kind === k));
