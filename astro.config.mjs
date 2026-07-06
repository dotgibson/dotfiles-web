// @ts-check
import { defineConfig } from "astro/config";

// Served from a GitHub Pages PROJECT path: https://dotgibson.github.io/dotfiles-web/
// `site` + `base` make all internal links and assets resolve under the subpath.
// If you later move to a custom domain or a user site (dotgibson.github.io), set
// `base: '/'` and update `site` accordingly.
export default defineConfig({
  site: "https://dotgibson.github.io",
  base: "/dotfiles-web",
  trailingSlash: "ignore",
  build: {
    format: "directory",
  },
  markdown: {
    // Match the docs-hub Markdown code blocks to the site's Tokyo Night theme.
    shikiConfig: {
      theme: "tokyo-night",
    },
  },
});
