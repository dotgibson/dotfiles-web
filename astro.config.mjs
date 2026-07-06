// @ts-check
import { defineConfig } from "astro/config";

// Served from a GitHub Pages PROJECT path: https://dotgibson.github.io/dotfiles-web/
// `site` + `base` make all internal links and assets resolve under the subpath.
// If you later move to a custom domain or a user site (dotgibson.github.io), set
// `base: '/'` and update `site` accordingly.
const BASE = "/dotfiles-web";

// Rewrite root-relative Markdown links (`/docs/...`) so they respect the `base` path.
// Astro applies `base` to `withBase()`/asset URLs but NOT to raw Markdown link hrefs, so
// a `[x](/docs/y)` would deploy as `/docs/y` and 404 under the project subpath. This lets
// doc authors keep writing simple root-relative links; every internal one gets `base`
// prepended at build time. Protocol-relative (`//host`) and external links are left alone.
function rehypeBaseLinks() {
  /** @param {any} node */
  const walk = (node) => {
    if (node.type === "element" && node.tagName === "a") {
      const href = node.properties?.href;
      if (typeof href === "string" && href.startsWith("/") && !href.startsWith("//")) {
        node.properties.href = BASE + href;
      }
    }
    node.children?.forEach(walk);
  };
  return (/** @type {any} */ tree) => walk(tree);
}

export default defineConfig({
  site: "https://dotgibson.github.io",
  base: BASE,
  trailingSlash: "ignore",
  build: {
    format: "directory",
  },
  markdown: {
    // Match the docs-hub Markdown code blocks to the site's Tokyo Night theme.
    shikiConfig: {
      theme: "tokyo-night",
    },
    rehypePlugins: [rehypeBaseLinks],
  },
});
