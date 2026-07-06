import { getCollection, type CollectionEntry } from 'astro:content';

// Sidebar section order. Sections not listed here sort to the end, alphabetically.
export const SECTION_ORDER = ['Introduction', 'Concepts', 'Guides', 'Reference', 'Repositories'];

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

  navCache = result;
  return result;
}
