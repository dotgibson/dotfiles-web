// Build-time GitHub metadata for the repo cards: stars, last push, and the latest
// CI conclusion on the default branch. Fetched once per build (Astro frontmatter
// runs at build time for static output) and merged into the cards.
//
// Resilience is the whole point: GitHub is rate-limited (60 req/h unauthenticated)
// and can be flaky, but a Pages deploy must never fail because of it. Every fetch
// is wrapped, time-boxed, and falls back to null — cards then render without the
// live badges rather than breaking the build. CI passes a token via GITHUB_TOKEN
// for a higher rate limit and access to the Actions API.
import { site } from '../data/site';

export interface RepoLive {
  stars: number | null;
  pushedAt: string | null; // ISO timestamp of the last push to the default branch
  ci: 'success' | 'failure' | 'neutral' | null; // latest completed run on main
}

const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
const headers: Record<string, string> = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'dotfiles-web-build',
  'X-GitHub-Api-Version': '2022-11-28',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
};

// One fetch, best-effort: a 5s deadline, any non-2xx or network error → null.
async function fetchJson(url: string): Promise<any | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function getOne(name: string): Promise<RepoLive> {
  const base = `https://api.github.com/repos/${site.githubUser}/${name}`;
  // Repo info first (stars, pushed_at, default_branch). We query workflow runs on
  // the actual default branch — falling back to main — so a renamed default branch
  // doesn't silently null the CI badge while CI is healthy. Repos run in parallel
  // via getRepoLiveMap, so this per-repo sequencing costs one extra round-trip, not
  // a serialized build. The Actions call may 404/403 (no workflows / no token
  // access) — that just leaves ci null.
  const info = await fetchJson(base);
  const branch = info?.default_branch || 'main';
  const runs = await fetchJson(
    `${base}/actions/runs?branch=${encodeURIComponent(branch)}&status=completed&per_page=1`
  );
  let ci: RepoLive['ci'] = null;
  const run = runs?.workflow_runs?.[0];
  if (run) ci = run.conclusion === 'success' ? 'success' : run.conclusion === 'failure' ? 'failure' : 'neutral';
  return {
    stars: typeof info?.stargazers_count === 'number' ? info.stargazers_count : null,
    pushedAt: info?.pushed_at ?? null,
    ci,
  };
}

// Fetch every repo in parallel, return a name -> RepoLive map. Always resolves;
// repos that fail simply carry all-null values.
export async function getRepoLiveMap(names: string[]): Promise<Record<string, RepoLive>> {
  const entries = await Promise.all(names.map(async (n) => [n, await getOne(n)] as const));
  return Object.fromEntries(entries);
}

// "3d ago" / "2mo ago" — a compact relative age for the last push.
export function relativeAge(iso: string | null): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}
