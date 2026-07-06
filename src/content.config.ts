import { defineCollection } from 'astro:content';
import { z } from 'astro:schema';
import { glob } from 'astro/loaders';

// The documentation hub. Author pages as Markdown under src/content/docs/<...>/*.md.
// `section` groups a page in the sidebar (see SECTION_ORDER in src/lib/docs.ts);
// `order` sorts pages within a group. The file path (minus extension) becomes the
// URL: src/content/docs/concepts/three-layer-model.md → /docs/concepts/three-layer-model
const docs = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/docs' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    section: z.string().default('Guides'),
    order: z.number().default(0),
  }),
});

export const collections = { docs };
