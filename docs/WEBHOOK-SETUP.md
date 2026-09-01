# Activating the showcase auto-refresh

This site is static (Astro → GitHub Pages), so "clear the cache" means **rebuild
and re-publish the Pages artifact**. `.github/workflows/deploy.yml` exposes a
`repository_dispatch` (`refresh` / `release`) receiver for that, and each source
repo ships a `.github/workflows/notify-web.yml` dispatcher that pings it on push.

> **The `WEBHOOK_SECRET` PAT flow this page used to describe is retired.**
> It walked you through minting a fine-grained PAT and pasting it into eleven
> repos. That credential was **deleted fleet-wide** when the GitHub App migration
> (G2) finished — see dotgibson/dotfiles-core#683 — and every dispatcher now mints
> its own short-lived token instead. Following the old steps would recreate exactly
> the long-lived, hand-rotated credential the migration removed, so they are gone
> rather than merely marked stale.

## How the dispatch authenticates now

Each source repo's dispatcher mints a **GitHub App installation token at run
time**, scoped to `dotfiles-web` and to `contents: write`, which expires in about
an hour. The `Bearer` on the `repository_dispatch` POST is that token. Nothing
long-lived is stored in any repo.

It needs exactly two things to be visible to the dispatching repo, both set once
at the **organization** level:

| Name | Kind | What it is |
| --- | --- | --- |
| `FLEET_APP_ID` | variable | the fleet App's ID (not sensitive — a variable so it can be read in a job `if:`) |
| `FLEET_APP_PRIVATE_KEY` | secret | the App's `.pem`, in full |

**The full runbook — registering the App, its permissions, which repos the
installation must cover, and how to recover if it breaks — lives upstream in
[dotfiles-core's `GITHUB-APP-AUTH.md`](https://github.com/dotgibson/dotfiles-core/blob/main/GITHUB-APP-AUTH.md).**
That is the single source of truth for fleet auth; this page deliberately does not
duplicate it, because two copies of a credential runbook is how the fleet ended up
asserting contradictory things about these tokens in the first place.

There is **no PAT fallback**. If the App credentials are absent the dispatcher
logs a warning and exits 0 — the site simply is not refreshed until the next push
or the hourly poll.

## Verify

No commit required:

1. In a source repo (e.g. `dotfiles-core`) → **Actions → "Refresh showcase" →
   Run workflow** (the `workflow_dispatch` trigger).
2. The run should succeed and log `Dispatched refresh to dotfiles-web`.
3. In **`dotfiles-web` → Actions**, a **"Deploy to GitHub Pages"** run should
   start within a few seconds (triggered by `repository_dispatch: refresh`).

A dispatcher run that logs `App auth not configured here` means the org variable
or secret is not visible to that repo — check both, and check that the App's
installation actually covers `dotfiles-web`.

A dispatcher run that **fails** inside `Mint a scoped installation token` is the
other case, and it is a different problem: the credentials were found but the App
cannot reach `dotfiles-web`. Check the installation's repository list.
