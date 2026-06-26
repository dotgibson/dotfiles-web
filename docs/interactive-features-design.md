# Design — Interactive features for `dotfiles-web`

**Status:** Proposal / design-only. No feature code in this change — this document
is the spec to review before any implementation lands.

**Audience:** CLI purists. Everything here optimises for a copy-pasteable,
deterministic, no-surprises command line over clickable magic.

**Scope.** Three features, decided up front:

1. A **Bootstrap Command Generator** — pick modules/platform, get one custom
   install string.
2. A **Diff / Update Feed** — the changelog, reworked into a developer-friendly,
   filterable feed that surfaces perf and config changes.
3. The **architecture for a universal `install.sh` / `install.ps1`** entry point
   with environment detection.

**Two decisions already locked** (they constrain the whole design):

- **The generator's commands invoke the *existing* per-repo `bootstrap.sh` +
  flags** — its default output is a readable clone-then-run, not a blind
  `curl | bash`. Whatever the generator emits must be a real command that works
  against the repos as they are today (or against a small, in-tree bootstrap
  enhancement described in §1.3). *(Separately, the operator wants a hosted
  one-liner as the **landing-page hero** — that's the §3 dispatcher's public face,
  designed in §4; it still only routes to those same per-repo bootstraps, so the
  two are consistent.)*
- The site is a **static Astro build** deployed to GitHub Pages. There is no
  server at request time. Every "dynamic" behaviour is either *build-time* (Astro
  frontmatter / `collect-metrics.mjs`) or *client-side* progressive enhancement.
  No new runtime backend is introduced.

---

## 0. Constraints & the primitives we build on

Before designing anything, the rules this repo already lives by:

| Constraint | Consequence for these features |
| --- | --- |
| Static output, no request-time server | "Generator backend" = a typed data model compiled into the page + pure client-side string synthesis. No API. |
| Docs must not drift from the source repos (`CLAUDE.md`) | Two tiers, both anti-drift: **machine-derived** facts (counts, changelog content) are *generated* from the repos via `collect-metrics.mjs`; **hand-authored** config (the generator's `bootstrap.ts`, exactly like today's `src/data/install.ts`) is allowed but must be **verified against source** by a CI guard — see §1.4. Neither tier is silently hand-retyped. |
| Build must never fail on GitHub flakiness (`src/lib/github.ts`) | Any new network use stays best-effort, time-boxed, null-fallback. Prefer build-time + committed JSON. |
| Tokyo Night theme, existing CSS tokens (`src/styles/global.css`) | Reuse `--tn-*` tokens, `.badge`, `.card`, `.tone-*`, `CommandBlock`. No new design system. |
| Strict ref validation already exists (`REF_PATTERN`, `isValidRef`) | The generator reuses it verbatim for any user-influenced ref. Never interpolate an unvalidated token into a command. |

**Reuse, don't reinvent:**

- `src/components/CommandBlock.astro` — renders a command with per-line prompt
  glyphs + a `[data-copy]` button. The generator's output IS a `CommandBlock`.
- The global copy handler in `Base.astro` reads `data-code`. The generator keeps
  `data-code` in sync as the user toggles options — exactly the pattern the Get
  Started version-switcher already uses (`getting-started.astro` lines 335-387).
- `src/data/*.ts` — typed, hand-authored prose + `src/data/generated.json` —
  machine-derived numbers. New config follows the same split.

---

## 1. Bootstrap Command Generator

### 1.1 The honest reality check (this drives everything)

The feature premise is "let users select which modules they want (Zsh,
PowerShell, Neovim core) and generate a custom install string." Before designing
the UI, here is what the bootstraps **actually expose today** (verified against
`bootstrap.sh` in each repo):

| Repo | Real flags today |
| --- | --- |
| Fedora / Arch / openSUSE / Alpine / Gentoo | `--links-only`, `--no-flatpak` (Fedora/SUSE), distro quirks |
| Kali | `--links-only`, `--no-offensive` |
| macOS | `--links-only`, `--no-brew`, `--macos-defaults`, `--set-shell`, `--uninstall`, `--dry-run`/`-n`, `--quiet`/`-q`, `--json` (+ a `KNOWN_FLAGS` allowlist) |
| Windows (`install.ps1`) | `-SkipPackages`, `-DryRun`, `-NonInteractive`, `-Yes`, `-Help` |

**The gap:** every bootstrap symlinks the **whole Core** (the `zsh/*` chain,
`nvim/`, `tmux/`, starship, lazygit, `bin/`) as one unit — see `core.manifest`.
There is **no `--only zsh` / `--no-nvim` selector anywhere**. The existing flags
are *provisioning* toggles (skip packages / skip GUI apps / links-only), not
*module* selectors.

Also: the three named modules **do not live in one layer**:

- **Zsh** and **Neovim core** are **Core** — vendored into every OS repo, mirrored
  to Windows via `nvim-sync.ps1`. Cross-platform.
- **PowerShell** is a **Windows-host-only** layer (`powershell/core/` in
  `dotfiles-Windows`) — it is *not* vendored Core and has no meaning on
  macOS/Linux.

So a literal "tick Zsh + PowerShell + Neovim, get one command" cannot be honestly
generated today, because (a) no per-module flag exists and (b) those modules
aren't co-located on any single platform.

We resolve this with **two design tracks**, and recommend Track A first.

### 1.2 Track A (recommended, ships now): platform-led generator over real flags

Model the generator on the *capabilities that exist*. The user's mental model
("what do I want on this box?") is preserved, but the selectable axes are the ones
the bootstraps can actually honour:

1. **Platform** (required, single-select): macOS / Windows / Kali / a Linux
   distro. This picks the repo and the flag dialect.
2. **Provisioning profile** (the real toggles, rendered as plain-language
   choices):
   - *Full* — packages + symlinks (default).
   - *Config only* — `--links-only` / `-SkipPackages` ("I already have my tools,
     just wire the dotfiles").
   - Platform extras as checkboxes that map 1:1 to a real flag:
     `--no-offensive` (Kali), `--no-flatpak` (Fedora/SUSE), `--macos-defaults`
     (macOS), `--no-brew` (macOS).
3. **Safety / preview** (checkboxes): *Dry-run first* (`--dry-run` / `-DryRun`),
   *Pin to a release* (reuses the existing version channel switcher logic).

Output = the **clone + bootstrap** pair the Get Started page already documents,
but assembled from the user's choices instead of static prose. This is 100% real
today and needs zero changes to any other repo.

### 1.3 Track B (the "module" promise, needs one small in-tree bootstrap change)

To deliver literal per-module selection ("just Zsh + Neovim, skip the rest"),
add **one new, additive flag** to the shared bootstrap. This is the only code
change outside `dotfiles-web` the feature would ever need, and it belongs in
`dotfiles-Fedora` first (the template) then fans out per `PORTING-MATRIX.md`:

```
./bootstrap.sh --only zsh,nvim       # link ONLY these Core module groups
./bootstrap.sh --skip nvim           # link everything except these
```

Proposed module-group vocabulary (derived from `core.manifest`, stable names the
web data model can rely on):

| Group key | Covers (from `core.manifest`) |
| --- | --- |
| `zsh` | `zsh/*.zsh` chain + `zsh/completions/*` |
| `nvim` | the `nvim/` tree |
| `tmux` | `tmux/` |
| `git` | git config + `zsh/git.zsh` |
| `prompt` | `starship/starship.toml` |
| `tools` | `lazygit/`, `bin/clip*`, mise wiring |

Implementation sketch (bootstrap side — *spec only, not built here*): the link
step already iterates a known set; gate each group behind a `want <group>` test
that consults a parsed `--only`/`--skip` set, defaulting to "all". `--only` is
purely subtractive over symlinks — it never changes provisioning — so it composes
cleanly with `--links-only`. PowerShell stays a Windows-only group surfaced only
when platform = Windows.

**Recommendation:** ship Track A now (real, zero-risk), and treat Track B's
`--only`/`--skip` as a fast-follow once the flag lands and is audited green in
`dotfiles-core`. The web data model (§1.4) is designed so Track B is a data-only
addition — no component rewrite.

### 1.4 Data model — `src/data/bootstrap.ts` (new, typed, hand-authored)

Mirrors the `src/data/install.ts` style. The component renders entirely from this;
adding a platform or a flag is a data edit.

```ts
export type Dialect = 'sh' | 'ps';

export interface BootstrapFlag {
  key: string;            // stable id for UI state, e.g. 'no-offensive'
  label: string;          // plain language: "Skip offensive tooling"
  flag: string;           // the literal token: '--no-offensive'
  help: string;           // one-line explanation
  default: boolean;       // pre-checked?
  kind: 'provision' | 'safety' | 'module'; // groups the UI
}

export interface BootstrapTarget {
  id: string;             // 'kali', 'macos', 'fedora', ...
  label: string;
  repo: string;           // 'dotfiles-Kali'
  dialect: Dialect;       // drives clone form + prompt glyph + flag syntax
  entry: string;          // './bootstrap.sh' | '.\\install.ps1'
  cloneDir?: string;      // '~/dotfiles-Kali'
  flags: BootstrapFlag[]; // only the flags THIS target really supports
  notes?: string[];       // post-install reminders (e.g. WSL mirrored net)
}

export const targets: BootstrapTarget[] = [ /* one entry per repo, real flags */ ];
```

Key property: **a target only lists flags it actually accepts.** Selecting macOS
shows `--macos-defaults`; selecting Kali shows `--no-offensive`. No flag can be
emitted for a platform that would reject it (recall macOS's `KNOWN_FLAGS` rejects
unknowns with exit 1 — the generator must never produce that).

**Drift guard (this is the §0 verification tier).** Because `bootstrap.ts` is
hand-authored, a CI check (`scripts/verify-bootstrap-flags.mjs`, runnable in
`/doc-audit`) parses each repo's actual flag surface — the `case` arms in
`bootstrap.sh`, the macOS `KNOWN_FLAGS` array, the `param()` block in
`install.ps1` — and fails the build if `bootstrap.ts` lists a flag the repo
doesn't accept (or omits one it does). So the data is hand-authored for clarity
but cannot silently drift from source. (Track B's `module`-kind entries are
likewise checked against `core.manifest`.) An alternative is to *generate*
`bootstrap.ts` outright; the verify-don't-generate approach is recommended
because the human labels/help text have no machine source.

### 1.5 Frontend — component + client logic

A new page `src/pages/generator.astro` (or a section embedded in Get Started),
plus an island of vanilla TS (no framework — consistent with the rest of the
site). Structure:

```
<BootstrapGenerator>
  ├─ platform picker      (radio group; sets active target)
  ├─ options panel        (checkboxes generated from target.flags, grouped by kind)
  ├─ live output          (<CommandBlock> — clone line + bootstrap line)
  └─ post-install notes   (target.notes, e.g. WSL networking)
```

**State → command synthesis** (pure function, the testable core):

```ts
import { cloneRef, isValidRef } from '../data/site'; // reuse the canonical helpers

function synthesize(t: BootstrapTarget, selected: Set<string>, ref: string): string {
  // Validate FIRST — never interpolate an unvalidated ref into a command. cloneRef()
  // already throws on a bad ref; this explicit guard documents the invariant and
  // covers any direct caller. The UI only ever passes a pre-validated channel.
  if (ref !== 'main' && !isValidRef(ref)) throw new Error(`invalid ref: ${ref}`);
  const refFlag = cloneRef(ref);             // '' for main, '--branch <tag> ' otherwise
  const url = `https://github.com/Gerrrt/${t.repo}`;
  const dir = t.cloneDir ?? `~/${t.repo}`;   // default so we never emit `undefined`
  const clone = t.dialect === 'sh'
    ? `git clone ${refFlag}${url} ${dir}\ncd ${dir}`
    : `git clone ${refFlag}${url}\ncd ${t.repo}`;
  const flags = t.flags
    .filter(f => selected.has(f.key))
    .map(f => f.flag)            // already a literal from the typed data — never user text
    .join(' ');
  const run = `${t.entry}${flags ? ' ' + flags : ''}`;
  return `${clone}\n${run}`;
}
```

Wiring mirrors `getting-started.astro`: on any toggle, recompute, write the text
into the `.cb-text` spans **and** keep the copy button's `data-code` in sync so
the global copy handler stays correct.

**Safety invariants (CLI-purist trust is the whole product):**

- Flags come **only** from the typed data model — never from free text. There is
  no string the user types that reaches the command, so shell injection is
  structurally impossible.
- The one user-influenced token is the **release ref**, and it is run through the
  existing `isValidRef` / `REF_PATTERN` (`^[A-Za-z0-9._/-]+$`) before it can
  appear — identical to the rule already enforced on Get Started.
- The generator **never** emits a bare `curl ... | bash`. It emits clone-then-run,
  so the user can read the script before executing (the per-repo decision, and
  the right default for this audience).

**Progressive enhancement:** with JS off, the page server-renders a sensible
default command (full install, `main`) inside the same `CommandBlock`. The
toggles are an enhancement, not a dependency.

### 1.6 Files (Track A)

- **add** `src/data/bootstrap.ts` — targets + real flags.
- **add** `src/pages/generator.astro` — page + island (or a `<section>` reused on
  Get Started).
- **add** `src/components/BootstrapGenerator.astro` (optional split).
- **edit** `src/data/site.ts` `nav` — add a "Generator" entry (or link from Get
  Started).
- **no other repo touched.** (Track B later adds `--only`/`--skip` flags upstream
  + the `module`-kind entries in `bootstrap.ts`.)

---

## 2. Changelog → Diff / Update Feed

### 2.1 Review of the current pipeline

What exists (and is good): `collect-metrics.mjs` parses each repo's
`CHANGELOG.md` (Keep a Changelog format) at build time into
`generated.json#changelog`; `src/data/changelog.ts` types it; `changelog.astro`
renders per-repo entries grouped by category, tinting the four known categories.
**No hand-kept mirror, no runtime API call** — correct and drift-resistant.

Limitations for a "developer-friendly Diff/Update Feed":

1. **Per-repo silos, no unified timeline.** You can't see "what changed across the
   fleet recently" at a glance — entries are grouped by repo, not by recency.
2. **No semantic highlighting.** A perf win and a docs tweak look identical. The
   request explicitly wants perf + config changes surfaced.
3. **Only the newest version block per repo** is parsed (`parseChangelog` stops at
   the second `## ` heading). A "feed" implies history/depth.
4. **No Core fan-out signal.** A Core entry actually ships to all 8 OS repos — the
   single highest-value fact — and it's rendered like any other line.
5. **No filtering / no anchors / no per-entry permalinks.**

### 2.2 Enhancement A — semantic classification (build-time)

Tag every change item with a `kind` so the feed can highlight and filter. Two
honest signals, both already present in the source:

- **Keep a Changelog category** → coarse kind (`Added/Changed/Fixed/Security`).
- **Conventional Commits prefix** — the fleet already commits with
  `type(scope): summary` (mandated in `dotfiles-core/CLAUDE.md`). When changelog
  items echo that, or when we additionally scan commit subjects, map:

| Signal | Feed kind | Tone token |
| --- | --- | --- |
| `perf:`, words "faster / benchmark / lazy / startup" | `perf` | green |
| `feat:` / "Added" | `feature` | blue |
| `fix:` / "Fixed" | `fix` | cyan |
| `refactor:`, `chore(config)`, "config / manifest / load order" | `config` | purple |
| `security:` / "Security" | `security` | red |
| else | `other` | muted |

Classification is a pure function added to `collect-metrics.mjs`
(`classify(item, category) -> kind`), keyword-table driven, with the category as
the fallback. Deterministic, testable, no network.

### 2.3 `generated.json` shape change (additive, backward-compatible)

Extend each change item from a bare `string` to an object, and add a flat
`feed` projection so the page doesn't re-derive ordering at render time:

```jsonc
// changelog[].groups[].items[]  : "string"  ->  { "text": "...", "kind": "perf" }
// + new top-level:
"feed": [
  { "repo": "dotfiles-core", "version": "v1.2.0", "date": "2026-01-02",
    "kind": "perf", "text": "lazy-compile zsh modules — 40ms faster startup",
    "core": true }      // core:true => fans out to all OS repos
]
```

`feed` is the changelog flattened to one item per change, sorted by `date` desc
(undated `Unreleased` floats to top), each carrying its repo/version/kind. The
existing per-repo `changelog[]` stays for the grouped view. `core:true` is set for
every item whose repo is `dotfiles-core`.

Backward-compat: `changelog.ts` keeps a tiny adapter so old `string` items still
render if a stale JSON is present.

### 2.4 Feed UX (`changelog.astro`, reworked)

- **Two views, one page:** a default **unified feed** (reverse-chronological,
  cross-repo) and the existing **by-repo** grouping behind a toggle.
- **Kind filter chips** (`All · Perf · Features · Fixes · Config · Security`) —
  client-side `hidden` toggling, same pattern as the platform tabs. Purists get a
  keyboard-navigable, no-reload filter.
- **Highlight rail:** perf + security items get a left accent bar (`--tn-green` /
  `--tn-red`) and a `kind` badge, so "what got faster" is scannable — directly
  answering the request.
- **Core fan-out badge:** items with `core:true` show a `↳ ships to all 8 repos`
  pill. This is the system's signature fact and the feed should lead with it.
- **Per-item permalinks + source link** to the repo's `CHANGELOG.md` (already have
  the URL pattern).
- Each item already renders as plain text; the only new DOM is the badge + accent,
  reusing `.badge`/`.tone-*`.

### 2.5 The `github.ts` fetching review (separate concern, keep build-time)

`src/lib/github.ts` is used for the **repo cards' live badges** (stars, last push,
CI), not the changelog — worth stating clearly since the request conflated them.
Its design is already sound: 5s deadline, null-fallback, parallel per-repo,
default-branch-aware CI lookup. Recommended optimisations (small, optional):

- **Conditional requests / ETag** — store `pushed_at`-keyed ETags to cut rate-limit
  pressure on rebuilds. Marginal for a once-per-deploy build; skip unless CI builds
  get frequent.
- **One round-trip instead of two** where possible: the repo object already yields
  stars + `pushed_at`; only CI needs the second call. Already minimal.
- **Keep the changelog OUT of this path.** The feed must stay build-time-from-files
  (`collect-metrics.mjs`), never a client/runtime GitHub call — otherwise we
  reintroduce the rate-limit + flakiness the current design deliberately avoids,
  and the feed could differ between two visitors. **No change recommended here**
  beyond optional ETags.

**Verdict:** the changelog feed is a `collect-metrics.mjs` + render change; the
GitHub API layer needs no rework to serve it. Don't move changelog data to the API
path.

---

## 3. Universal `install.sh` / `install.ps1` — architecture

### 3.1 Goal & shape

A single memorable entry per OS family that **detects the environment, picks the
right repo, and delegates to that repo's existing `bootstrap.sh` / `install.ps1`**
— passing through any flags the generator (§1) produced. Given the locked decision
("invoke existing per-repo bootstrap"), the universal script is a **thin
dispatcher**, *not* a second installer. It must never reimplement provisioning.

```
install.sh  →  detect OS/distro/WSL  →  git clone the matching dotfiles-<X>
            →  exec ./bootstrap.sh "$@"      (forward all flags verbatim)
install.ps1 →  detect host/pwsh/admin →  git clone dotfiles-Windows
            →  .\install.ps1 @args
```

### 3.2 Detection matrix (the only real logic)

| Probe | Source of truth | Routes to |
| --- | --- | --- |
| `uname -s` = Darwin | kernel | `dotfiles-MacBook` |
| `/etc/os-release` `ID`/`ID_LIKE` | os-release | Fedora/Arch/openSUSE/Alpine/Gentoo repo |
| Kali (`ID=kali`) | os-release | `dotfiles-Kali` |
| WSL (`$WSL_DISTRO_NAME` or `microsoft` in `/proc/version`) | env/proc | distro repo + emit WSL networking note |
| `ID_LIKE` fallback (e.g. `debian`) when exact `ID` unknown | os-release | nearest supported repo, with a confirm prompt |
| musl (`ldd --version` mentions musl) / `doas` present | toolchain | Alpine path |

Each `bootstrap.sh` **already re-validates** its own platform (Fedora's aborts if
`/etc/os-release` isn't Fedora; macOS guards on Darwin). So the dispatcher's
detection is a *convenience router*, and the per-repo guard is the *safety net* —
a misroute fails loudly in the real bootstrap rather than half-installing.

### 3.3 Flow (sh dispatcher — spec)

```sh
#!/usr/bin/env sh
set -eu
detect_repo() { /* uname + /etc/os-release + WSL + ID_LIKE → echo repo name */ }
REPO="$(detect_repo)" || { echo "unsupported OS; pick a repo manually: <list>"; exit 1; }
DEST="${DOTFILES_DIR:-$HOME/$REPO}"
[ -d "$DEST/.git" ] || git clone "https://github.com/Gerrrt/$REPO" "$DEST"
cd "$DEST"
exec ./bootstrap.sh "$@"      # all generator flags forwarded untouched
```

`install.ps1` is the symmetric pwsh version → always `dotfiles-Windows`, checks
`$PSVersionTable` (pwsh 7+) and Developer Mode / elevation, then forwards
`@args` to the repo's `install.ps1`.

### 3.4 Where it lives & how the generator targets it

Two viable homes, both compatible with "per-repo bootstrap" (the dispatcher only
*calls* those bootstraps):

- **(Recommended) committed in each repo's root** as `install.sh` alongside
  `bootstrap.sh` — but since detection picks the repo, a single canonical copy is
  cleaner. Put the canonical dispatcher in **`dotfiles-core`** (it's the shared,
  fan-out layer) and vendor it out, or host it from the Pages site's `public/` so
  it's served at a stable `https://<pages-domain>/install.sh`.
- The **generator (§1) keeps emitting clone-then-bootstrap by default** (readable,
  the locked decision). The universal dispatcher is offered as an **optional
  "advanced / one-liner"** affordance for people who want it, clearly labelled as
  `curl | sh` with the trust trade-off spelled out.

### 3.5 Security model (non-negotiable for this audience)

- The default generator output is **clone-then-run**, never piped execution — the
  user can read `bootstrap.sh` first.
- If the optional universal one-liner is offered, document **`curl -fsSL … -o
  install.sh && less install.sh && sh install.sh`** as the reviewed path, and pin
  to a tag (reusing the release-channel mechanism) so `curl | sh` fetches a
  hermetic, immutable script.
- The dispatcher does nothing privileged itself; all `sudo`/`doas` stays inside
  the audited per-repo bootstraps where it already lives and is reviewed.

### 3.6 Non-goals

- No telemetry, no interactive TUI in the installer (flags are the interface).
- The dispatcher never installs packages or symlinks directly — it only routes.
  Provisioning stays single-sourced in each `bootstrap.sh`.

---

## 4. Landing-page hero — the one-liner dream

The operator's stated vision for the landing page is a single, irresistible
install string:

```sh
# For Linux/macOS (Zsh) & Windows (PowerShell)
curl -sS https://your-showcase.com | bash   # or the PowerShell equivalent
```

This is the **public face of the §3 universal dispatcher** — the URL serves the
OS-detecting script, which clones the right repo and runs its existing
`bootstrap.sh` (so it still honours the locked "invoke existing per-repo
bootstrap" decision; the dispatcher only *routes*). It replaces / augments the
current static terminal mock in `src/components/Hero.astro` (the clone +
`bootstrap.sh --links-only --dry-run` cassette).

### 4.1 The wrinkle: a bare domain can't pipe to a shell

`curl -sS https://your-showcase.com | bash` piping the **site root** would pipe
**HTML** into `bash`. Two honest ways to make the dream real on a static Pages
deploy:

- **(Recommended) a script path:** `curl -sSL https://<host>/install.sh | sh`.
  Trivially works from Pages `public/install.sh`. The hero shows this exact line.
- **User-Agent content negotiation** (the `sh.rustup.rs` trick — serve the script
  to `curl`, HTML to browsers from the *same* bare URL). Pages is static and
  *can't* content-negotiate, so this needs a tiny edge worker / redirect in front
  of the domain. More magic, more moving parts — defer unless a custom domain
  with an edge layer already exists.

So the realistic hero string is `…/install.sh | sh`, not the bare domain — worth
flagging because the bare-domain version reads great but won't run.

### 4.2 Platform-aware hero (client-side, progressive enhancement)

One shell can't serve both worlds — Windows needs `irm … | iex`, not `curl …
| bash`. The hero detects the visitor's OS client-side (`navigator.userAgentData`
/ `navigator.platform`) and shows the matching one-liner by default, with the
others one click away:

```
  macOS / Linux   curl -sSL https://<host>/install.sh | sh
  Windows         irm https://<host>/install.ps1 | iex
```

Detection is a *display* convenience only — both commands are always present (tabs
/ a small switch), and with JS off the hero falls back to showing the macOS/Linux
line plus a visible link to the Windows form. This mirrors the existing platform
tabs and version-switcher patterns already in the codebase — no new dependency.

### 4.3 Keeping CLI-purist trust at the front door

A blind `| sh` from the *hero* of a site aimed at CLI purists is a tension worth
designing for, not hand-waving:

- Show the pipe-to-shell as the headline, but pair it with a **"read it first"**
  secondary line in the same block:
  `curl -sSL https://<host>/install.sh -o install.sh && less install.sh && sh install.sh`.
- **Pin by default.** The hosted `install.sh` is served at a **tagged**,
  immutable path (reusing the release-channel mechanism), so `| sh` fetches a
  hermetic script, not a moving `main`.
- The dispatcher does nothing privileged itself; all `sudo`/`doas` stays inside
  the audited per-repo bootstraps (per §3.5).
- Link the hero one-liner straight to the **§1 generator** ("want just Zsh +
  Neovim, or a dry run first? build a custom command →") so the curious land on
  the readable, flag-by-flag path.

### 4.4 Relationship to the locked decisions & generator

- The generator (§1) still **defaults to clone-then-run** — the readable path.
- The hero one-liner is the **aspirational headline** and depends on the §3
  dispatcher shipping + being hosted (Phase 3 below). Until then, the hero keeps
  today's clone + `bootstrap.sh` cassette, optionally swapped for a *non-executing*
  animated preview of the future one-liner so the page can promise it before the
  infra lands.
- Files touched when it ships: `src/components/Hero.astro` (the headline block),
  `public/install.sh` + `public/install.ps1` (the served dispatcher, or a redirect
  to the canonical copy in `dotfiles-core`), and a `host` constant in
  `src/data/site.ts`.

---

## 5. Recommended rollout

1. **Phase 1 (web-only, zero external risk):** Track A generator + the Diff/Update
   Feed. Both are pure `dotfiles-web` changes (new `bootstrap.ts`, generator page,
   `collect-metrics.mjs` classification, reworked `changelog.astro`). Ship behind
   `make`-style local preview, run `/doc-audit` to confirm no drift.
2. **Phase 2 (one upstream change):** add `--only`/`--skip` to `dotfiles-Fedora`
   bootstrap, audit green in `dotfiles-core`, fan out per `PORTING-MATRIX.md`;
   then flip on the `module`-kind options in `bootstrap.ts` (data-only on the web
   side). Delivers literal module selection (Track B).
3. **Phase 3 (the one-liner dream, §4):** the universal dispatcher in
   `dotfiles-core` served from Pages `public/install.sh` + `install.ps1`, surfaced
   as both the generator's advanced one-liner **and the landing-page hero**
   (`Hero.astro`). Pin it to a tag and ship the "read it first" companion line.
   Until this lands, the hero keeps today's clone + `bootstrap.sh` cassette.

Each phase is independently shippable and independently revertible; nothing in
Phase 1 depends on Phases 2-3. The headline hero one-liner (§4) is the most
visible payoff but the most infra — hence last, behind the dispatcher it depends on.

---

## Appendix — verified flag reference (as of this writing)

| Repo | Entry | Flags actually parsed in source |
| --- | --- | --- |
| Fedora | `./bootstrap.sh` | `--links-only`, `--no-flatpak`, `-h/--help` |
| Kali | `./bootstrap.sh` | `--links-only`, `--no-offensive` |
| macOS | `./bootstrap.sh` | `--links-only`, `--no-brew`, `--macos-defaults`, `--set-shell`, `--uninstall`, `--dry-run`/`-n`, `--quiet`/`-q`, `--json`, `-h/--help` (validated against `KNOWN_FLAGS`) |
| Windows | `.\install.ps1` | `-SkipPackages`, `-DryRun`, `-NonInteractive`, `-Yes`, `-Help` |
| Arch/openSUSE/Alpine/Gentoo | `./bootstrap.sh` | `--links-only` + distro-specific (per each repo's header) |

> Re-verify this table against the repos before implementing — it is the contract
> the generator's `bootstrap.ts` must match exactly, and unknown flags hard-fail on
> macOS.
