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

The **changelog** is no longer hand-edited: `src/data/changelog.ts` just re-exports
the entries parsed from each repo's `CHANGELOG.md` into `generated.json` (see below).

Styling lives in `src/styles/global.css` (Tokyo Night design tokens at the top).

## Source-derived data (metrics + changelog)

The "by the numbers" strip, the per-card package counts, and the **changelog** are
**not** hand-typed — they come from `src/data/generated.json`, which
`scripts/collect-metrics.mjs` derives by reading the sibling repos (`../dotfiles-core`,
`../dotfiles-Fedora`, …). The changelog is parsed from each repo's `CHANGELOG.md`
(newest version block, Keep a Changelog format):

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

### Refreshing the showcase when a source repo changes (the "cache purge")

This site is **static** — there is no server runtime and therefore no per-request
cache to invalidate. The equivalent of "clear the cache" is to **rebuild and
re-publish the Pages artifact**, which the deploy workflow already exposes as a
[`repository_dispatch`](https://docs.github.com/actions/using-workflows/events-that-trigger-workflows#repository_dispatch)
receiver. A source repo (`dotfiles-core`, an OS repo, …) pings it on push.

> **Activating it:** the dispatchers are inert until a `GITHUB_WEBHOOK_SECRET`
> secret is added to each source repo. See [`docs/WEBHOOK-SETUP.md`](docs/WEBHOOK-SETUP.md)
> for the one-time token + secret walkthrough.

Under the hood, the dispatch is:

```bash
curl -fsS -X POST \
  --max-time 30 --retry 3 --retry-delay 5 --retry-connrefused \
  -H "Authorization: Bearer $GITHUB_WEBHOOK_SECRET" \
  -H "Accept: application/vnd.github+json" \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  https://api.github.com/repos/Gerrrt/dotfiles-web/dispatches \
  -d '{"event_type":"refresh"}'
```

- **`refresh`** rebuilds from each repo's **default branch** (regenerates
  `src/data/generated.json` from the live fleet, then redeploys) — use this for an
  ordinary push.
- **`release`** pins the whole fleet to a tag first
  (`{"event_type":"release","client_payload":{"ref":"v1.0.0"}}`) — used by
  dotfiles-core's release workflow.

As a drop-in for a source repo (`.github/workflows/notify-web.yml`):

```yaml
name: Refresh showcase
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
jobs:
  dispatch:
    # Any repo under the canonical owner may dispatch; forks are excluded.
    if: github.repository_owner == 'Gerrrt'
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - env:
          TOKEN: ${{ secrets.GITHUB_WEBHOOK_SECRET }}
        run: |
          set -euo pipefail
          if [ -z "${TOKEN:-}" ]; then
            echo "::warning::GITHUB_WEBHOOK_SECRET not set — skipping showcase refresh"
            exit 0
          fi
          curl -fsS -X POST \
            --max-time 30 --retry 3 --retry-delay 5 --retry-connrefused \
            -H "Authorization: Bearer ${TOKEN}" \
            -H "Accept: application/vnd.github+json" \
            -H "Content-Type: application/json" \
            -H "X-GitHub-Api-Version: 2022-11-28" \
            https://api.github.com/repos/Gerrrt/dotfiles-web/dispatches \
            -d '{"event_type":"refresh"}'
```

This mirrors the `notify-web.yml` that ships in each source repo (core + the eight
OS repos).

### Environment variables / secrets

| Variable                | Where it lives                          | Purpose                                                                                                              |
| ----------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `GITHUB_TOKEN`          | auto-injected in **this** repo's CI     | Higher GitHub API rate limit + Actions access for the live repo-card badges during the Astro build. Build is resilient if unset. |
| `GITHUB_WEBHOOK_SECRET` | a **secret in each dispatching** source repo | A fine-grained **PAT** scoped **Contents: Read and write** (`contents:write`) on `dotfiles-web`, used as the `Authorization: Bearer` token on the `repository_dispatch` POST that triggers a rebuild. GitHub authenticates the caller via this token, so the static site needs no HMAC signature-verification layer of its own. |

### Changing the URL

The site is configured for a GitHub Pages *project* path in `astro.config.mjs`
(`site` + `base`). To serve from a custom domain or a user site (`gerrrt.github.io`),
set `base: '/'`, update `site`, and add a `public/CNAME` for a custom domain.
