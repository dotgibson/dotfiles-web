import { getCollection, type CollectionEntry } from 'astro:content';
import { repos, type Layer } from '../data/repos';

// Sidebar section order. Sections not listed here sort to the end, alphabetically.
export const SECTION_ORDER = ['Introduction', 'Concepts', 'Guides', 'Reference', 'Repositories'];

// The Repositories section is generated from src/data/repos.ts (single source of truth for
// repo prose), grouped by layer so it reads Core → OS → host → role.
const LAYER_RANK: Record<Layer, number> = { core: 0, os: 1, host: 2, role: 3 };
function repositoriesSection(): DocSection {
  return {
    section: 'Repositories',
    items: [...repos]
      .sort((a, b) => LAYER_RANK[a.layer] - LAYER_RANK[b.layer])
      .map((r, i) => ({ title: r.name, slug: `repos/${r.name}`, order: i })),
  };
}

export type DocLink = { title: string; slug: string; order: number };
export type DocSection = { section: string; items: DocLink[] };

// Built once per process and reused. The docs collection is fixed for a production
// build, so every page render (and the sidebar in DocsLayout) shares one computed tree
// instead of rebuilding it. Only cached in PROD — in dev, HMR should reflect new pages.
let navCache: DocSection[] | null = null;

// Build the grouped, ordered sidebar tree from the `docs` collection.
export async function getDocsNav(): Promise<DocSection[]> {
  if (navCache && import.meta.env.PROD) return navCache;

  const entries: CollectionEntry<'docs'>[] = await getCollection('docs');
  const groups = new Map<string, DocLink[]>();

  for (const entry of entries) {
    const section = entry.data.section;
    const list = groups.get(section) ?? [];
    list.push({ title: entry.data.title, slug: entry.id, order: entry.data.order });
    groups.set(section, list);
  }

  const rank = (s: string) => {
    const i = SECTION_ORDER.indexOf(s);
    return i === -1 ? SECTION_ORDER.length : i;
  };

  const result = [...groups.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([section, items]) => ({
      section,
      items: items.sort((x, y) => x.order - y.order || x.title.localeCompare(y.title)),
    }));

  // Append the generated Repositories section (last per SECTION_ORDER).
  result.push(repositoriesSection());

  navCache = result;
  return result;
}
