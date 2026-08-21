# Activating the showcase auto-refresh

This site is static (Astro → GitHub Pages), so "clear the cache" means **rebuild
and re-publish the Pages artifact**. `.github/workflows/deploy.yml` exposes a
`repository_dispatch` (`refresh` / `release`) receiver for that, and each source
repo ships a `.github/workflows/notify-web.yml` dispatcher that pings it on push.

The dispatchers are inert until a `WEBHOOK_SECRET` secret is present — they
log a warning and exit 0 otherwise. The two one-time steps below wire it up.

## 1. Create the token (once)

A single fine-grained PAT, scoped to do exactly one thing: trigger a rebuild of
`dotfiles-web`.

1. **github.com → avatar → Settings → Developer settings**
2. **Personal access tokens → Fine-grained tokens → Generate new token**
3. Fill in:
   - **Token name:** e.g. `dotfiles-web-refresh`
   - **Expiration:** 90 days is the safe default (GitHub emails you before it
     lapses; when it does, the dispatchers no-op — log a warning and exit 0 —
     until you re-paste a new one). "No expiration" works but loses that safety
     net.
   - **Resource owner:** `dotgibson`
4. **Repository access → Only select repositories →** `dotfiles-web`
5. **Permissions → Repository permissions → Contents → Read and write**
   (`contents:write`). Leave the rest; "Metadata: Read-only" is added
   automatically and required.
6. **Generate token** and **copy it now** — it's shown only once
   (`github_pat_…`).

Scoping to only `dotfiles-web` + only Contents keeps the blast radius to this one
repo — a leaked token can't touch any other repo. Note that **Contents: write**
still lets it modify `dotfiles-web`'s own contents (not just fire a dispatch), so
treat it like any real credential: keep it in Actions secrets only, and rotate it
if it's ever exposed.

## 2. Add it as a secret in each source repo (11×)

The same token value goes into all eleven repos, added per-repo below. (`dotgibson`
is an org, so you could alternatively set a single organization-level secret and
skip the repeat — the per-repo setup keeps each source repo self-contained.)

For each of `dotfiles-core`, `dotfiles-MacBook`, `dotfiles-Windows`,
`dotfiles-Offense`, `dotfiles-Defense`, `dotfiles-Fedora`, `dotfiles-Arch`,
`dotfiles-Debian`, `dotfiles-openSUSE`, `dotfiles-Alpine`, `dotfiles-Gentoo`:

1. Repo → **Settings → Secrets and variables → Actions**
2. **New repository secret**
3. **Name:** `WEBHOOK_SECRET` (must match exactly) — **Value:** the token
4. **Add secret**

### Or do all eleven from the terminal with `gh`

Run from a `dotfiles-web` checkout: the repo names come from
`scripts/fleet-repos.txt`, the same list CI clones from, so this loop cannot fall
behind a rename the way a hand-typed one did — it used to say `Kali`, and because
github.com still redirects that name to `dotfiles-Offense`, the loop *succeeded*
while telling you it had set the secret on a repo that no longer exists under that
name. `htpx` is skipped: it is tagged `aux` in the manifest and is a corpus source,
not one of the eleven that trigger a refresh.

```bash
read -rs TOKEN   # paste github_pat_..., press Enter — kept off-screen & out of history

for r in $(awk '$1 !~ /^#/ && ($2 == "core" || $2 == "os") { print $1 }' scripts/fleet-repos.txt); do
  printf '%s' "$TOKEN" | gh secret set WEBHOOK_SECRET --repo "dotgibson/$r" --body -
  echo "set on $r"
done
unset TOKEN
```

## 3. Verify

No commit required:

1. In a source repo (e.g. `dotfiles-core`) → **Actions → "Refresh showcase" →
   Run workflow** (the `workflow_dispatch` trigger).
2. The run should succeed and log `Dispatched refresh to dotfiles-web`.
3. In **`dotfiles-web` → Actions**, a **"Deploy to GitHub Pages"** run should
   start within a few seconds (triggered by `repository_dispatch: refresh`).

A green dispatcher run that logs `WEBHOOK_SECRET not set — skipping
showcase refresh` means the secret isn't being picked up — re-check the name and
that it was added to that repo.
