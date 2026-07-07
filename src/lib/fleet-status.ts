// Build-time fleet status for the /status board. For each repo it reads two version
// lines from GitHub: the repo's OWN latest release tag, and — for the Core-vendoring
// layers — the Core tag it vendors (from the committed core.lock), compared against
// Core's latest release to surface drift.
//
// Fetched once per build, exactly like src/lib/github.ts (Astro frontmatter runs at
// build time for static output): token-aware, time-boxed, and ALWAYS null-safe, so a
// Pages deploy never fails because GitHub is rate-limited or flaky — the page just
// renders "temporarily unavailable" instead. CI passes GITHUB_TOKEN for the higher
// rate limit and private-repo reads (deploy.yml).
import { site } from '../data/site';
import { repos, type Layer } from '../data/repos';

export interface FleetRepoStatus {
  name: string;
  layer: Layer;
  release: string | null; // this repo's own latest release tag (its second version line)
  vendoredCore: string | null; // the Core tag it vendors (core.lock core_tag) — os/role only
  drift: 'current' | 'behind' | 'unknown' | null; // vendoredCore vs Core's latest release
}

export interface FleetStatus {
  coreLatest: string | null; // reference: dotfiles-core's latest release tag
  generatedAt: string; // ISO build timestamp
  repos: FleetRepoStatus[];
}

const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
const headers: Record<string, string> = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'dotfiles-web-build',
  'X-GitHub-Api-Version': '2022-11-28',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
};

// One fetch, best-effort: a 5s deadline, any non-2xx or network error → null. Same
// contract as src/lib/github.ts so a GitHub hiccup can never break the build.
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

const api = (name: string, path: string) =>
  `https://api.github.com/repos/${site.githubUser}/${name}${path}`;

// A repo's own latest published release tag (its vX.Y.Z line), or null if none/unreachable.
async function latestRelease(name: string): Promise<string | null> {
  const j = await fetchJson(api(name, '/releases/latest'));
  return typeof j?.tag_name === 'string' ? j.tag_name : null;
}

// The Core version a repo vendors, read from its committed core.lock. Prefer the
// clean SemVer (`core_version=3.1.0`); fall back to the `git describe` tag
// (`core_tag=v3.1.0-2-g<sha>`) only if an older lock lacks it.
async function vendoredCore(name: string): Promise<string | null> {
  const j = await fetchJson(api(name, '/contents/core.lock'));
  if (!j || typeof j.content !== 'string') return null;
  let text: string;
  try {
    text = Buffer.from(j.content, j.encoding === 'base64' ? 'base64' : 'utf8').toString('utf8');
  } catch {
    return null;
  }
  const v = text.match(/^\s*core_version\s*=\s*(.+?)\s*$/m);
  if (v) return v[1].trim();
  const t = text.match(/^\s*core_tag\s*=\s*(.+?)\s*$/m);
  return t ? t[1].trim() : null;
}

// The bare X.Y.Z base of a version/tag/describe string, for an apples-to-apples
// compare: "v3.1.0", "3.1.0", and "v3.1.0-2-g8acc1c0" all → "3.1.0".
const baseVer = (t: string | null): string | null =>
  t ? (t.replace(/^v/, '').match(/^\d+\.\d+\.\d+/)?.[0] ?? null) : null;

// Only the Core-vendoring layers (os + role) carry a core.lock. `core` is the
// reference itself; `host` (Windows) replicates Core rather than vendoring it — so
// neither shows a drift status.
const vendorsCore = (layer: Layer) => layer === 'os' || layer === 'role';

export async function getFleetStatus(): Promise<FleetStatus> {
  const coreLatest = await latestRelease('dotfiles-core');
  const statuses = await Promise.all(
    repos.map(async (r): Promise<FleetRepoStatus> => {
      const [release, core] = await Promise.all([
        latestRelease(r.name),
        vendorsCore(r.layer) ? vendoredCore(r.name) : Promise.resolve(null),
      ]);
      let drift: FleetRepoStatus['drift'] = null;
      if (vendorsCore(r.layer)) {
        const vb = baseVer(core);
        const cb = baseVer(coreLatest);
        drift = vb && cb ? (vb === cb ? 'current' : 'behind') : 'unknown';
      }
      return { name: r.name, layer: r.layer, release, vendoredCore: core, drift };
    })
  );
  return { coreLatest, generatedAt: new Date().toISOString(), repos: statuses };
}
