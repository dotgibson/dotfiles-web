# dotfiles-web

The showcase + docs site for the [dotfiles ecosystem](https://github.com/Gerrrt) —
a nine-repo, three-layer terminal environment (Core → OS-native → Role).

Built with [Astro](https://astro.build), themed in **Tokyo Night**, and deployed to
**GitHub Pages** at `https://gerrrt.github.io/dotfiles-web/`.

## What's here

| Page              | Path                | Purpose                                                        |
| ----------------- | ------------------- | ------------------------------------------------------------- |
| Landing           | `/`                 | Hero, value props, the three-layer model, repo map, install   |
| Getting started   | `/getting-started`  | Per-platform install guide (macOS / Windows / Kali / Linux)   |
| Architecture      | `/architecture`     | The Core → OS-native → Role model, subtree rationale, loader   |
| Changelog         | `/changelog`        | Curated mirror of the per-repo `CHANGELOG.md` files           |

## Develop

```bash
npm install        # install dependencies
npm run dev        # local dev server at http://localhost:4321/dotfiles-web
npm run build      # production build into dist/
npm run preview    # preview the production build locally
```

## Editing content

Content is data-driven — edit these and the site updates:

- `src/data/site.ts` — site name, owner, nav, GitHub links
- `src/data/repos.ts` — the repository map / showcase cards (prose + status)
- `src/data/install.ts` — per-platform install steps
- `src/data/changelog.ts` — the changelog mirror

Styling lives in `src/styles/global.css` (Tokyo Night design tokens at the top).

## Source-derived metrics

The "by the numbers" strip and the per-card package counts are **not** hand-typed —
they come from `src/data/generated.json`, which `scripts/collect-metrics.mjs` derives
by reading the sibling repos (`../dotfiles-core`, `../dotfiles-Fedora`, …):

```bash
npm run metrics      # checkout the sibling repos next to this one first
# or point it elsewhere:
DOTFILES_ROOT=/path/to/repos npm run metrics
```

Regenerate and commit `generated.json` whenever Core or an OS repo changes. The script
is defensive: if the sibling repos aren't checked out (e.g. on the Pages CI runner,
which clones only this repo), it leaves the committed JSON untouched.

## Deployment

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds with Astro and
publishes to GitHub Pages. **One-time setup:** in the repo's
**Settings → Pages**, set **Source** to **GitHub Actions**.

### Changing the URL

The site is configured for a GitHub Pages *project* path in `astro.config.mjs`
(`site` + `base`). To serve from a custom domain or a user site (`gerrrt.github.io`),
set `base: '/'`, update `site`, and add a `public/CNAME` for a custom domain.
