<!--
  STATUS-BADGES.md — copy-paste CI status badges for the nine-repo fleet.

  Two ready-to-integrate blocks:
    1. Markdown table  — drop into any README / docs page.
    2. HTML grid block — drop into the Astro showcase; it uses the site's own
       Tokyo Night CSS variables (--tn-*, --font-mono, --border …), so it themes
       itself with zero extra styling.

  Badge URL shape (GitHub Actions): the badge tracks the repo's DEFAULT branch.
    img : https://github.com/<owner>/<repo>/actions/workflows/<file>/badge.svg
    link: https://github.com/<owner>/<repo>/actions/workflows/<file>

  Workflow file per repo:
    • dotfiles-core / -MacBook / -Windows  → ci.yml   (full existing pipeline)
    • the six distro/role repos            → lint.yml (shellcheck · shfmt · syntax)

  When a repo's primary workflow file is renamed, update the matching row/card.
-->

# CI status badges

Live build status for every repository in the fleet. Owner: **Gerrrt**.

## 1. Markdown table

| Repository | Layer | Build |
| ---------- | ----- | ----- |
| [dotfiles-core](https://github.com/Gerrrt/dotfiles-core) | Core | [![CI](https://github.com/Gerrrt/dotfiles-core/actions/workflows/ci.yml/badge.svg)](https://github.com/Gerrrt/dotfiles-core/actions/workflows/ci.yml) |
| [dotfiles-MacBook](https://github.com/Gerrrt/dotfiles-MacBook) | OS-native | [![CI](https://github.com/Gerrrt/dotfiles-MacBook/actions/workflows/ci.yml/badge.svg)](https://github.com/Gerrrt/dotfiles-MacBook/actions/workflows/ci.yml) |
| [dotfiles-Windows](https://github.com/Gerrrt/dotfiles-Windows) | Native host | [![CI](https://github.com/Gerrrt/dotfiles-Windows/actions/workflows/ci.yml/badge.svg)](https://github.com/Gerrrt/dotfiles-Windows/actions/workflows/ci.yml) |
| [dotfiles-Kali](https://github.com/Gerrrt/dotfiles-Kali) | Role / offensive | [![lint](https://github.com/Gerrrt/dotfiles-Kali/actions/workflows/lint.yml/badge.svg)](https://github.com/Gerrrt/dotfiles-Kali/actions/workflows/lint.yml) |
| [dotfiles-Fedora](https://github.com/Gerrrt/dotfiles-Fedora) | OS-native | [![lint](https://github.com/Gerrrt/dotfiles-Fedora/actions/workflows/lint.yml/badge.svg)](https://github.com/Gerrrt/dotfiles-Fedora/actions/workflows/lint.yml) |
| [dotfiles-Arch](https://github.com/Gerrrt/dotfiles-Arch) | OS-native | [![lint](https://github.com/Gerrrt/dotfiles-Arch/actions/workflows/lint.yml/badge.svg)](https://github.com/Gerrrt/dotfiles-Arch/actions/workflows/lint.yml) |
| [dotfiles-openSUSE](https://github.com/Gerrrt/dotfiles-openSUSE) | OS-native | [![lint](https://github.com/Gerrrt/dotfiles-openSUSE/actions/workflows/lint.yml/badge.svg)](https://github.com/Gerrrt/dotfiles-openSUSE/actions/workflows/lint.yml) |
| [dotfiles-Alpine](https://github.com/Gerrrt/dotfiles-Alpine) | OS-native | [![lint](https://github.com/Gerrrt/dotfiles-Alpine/actions/workflows/lint.yml/badge.svg)](https://github.com/Gerrrt/dotfiles-Alpine/actions/workflows/lint.yml) |
| [dotfiles-Gentoo](https://github.com/Gerrrt/dotfiles-Gentoo) | OS-native | [![lint](https://github.com/Gerrrt/dotfiles-Gentoo/actions/workflows/lint.yml/badge.svg)](https://github.com/Gerrrt/dotfiles-Gentoo/actions/workflows/lint.yml) |

## 2. HTML grid block (Astro showcase)

Self-contained `<section>` — the scoped `<style>` references the site's existing
Tokyo Night custom properties, so it inherits the palette automatically. Paste it
into any `.astro` page (e.g. `src/pages/index.astro`) or lift the markup into a
component.

```html
<section class="ci-badges" aria-label="Fleet CI status">
  <h2 class="ci-badges__title">Continuous integration</h2>
  <p class="ci-badges__lead">Live build status across the nine-repo fleet.</p>

  <div class="ci-badges__grid">
    <!-- Core -->
    <a class="ci-card" href="https://github.com/Gerrrt/dotfiles-core/actions/workflows/ci.yml" target="_blank" rel="noopener">
      <div class="ci-card__head">
        <span class="ci-card__name">◆ dotfiles-core</span>
        <span class="ci-card__layer tone-purple">Core</span>
      </div>
      <img class="ci-card__badge" loading="lazy" alt="dotfiles-core CI status"
        src="https://github.com/Gerrrt/dotfiles-core/actions/workflows/ci.yml/badge.svg" />
    </a>

    <!-- MacBook -->
    <a class="ci-card" href="https://github.com/Gerrrt/dotfiles-MacBook/actions/workflows/ci.yml" target="_blank" rel="noopener">
      <div class="ci-card__head">
        <span class="ci-card__name">⌘ dotfiles-MacBook</span>
        <span class="ci-card__layer tone-blue">OS-native</span>
      </div>
      <img class="ci-card__badge" loading="lazy" alt="dotfiles-MacBook CI status"
        src="https://github.com/Gerrrt/dotfiles-MacBook/actions/workflows/ci.yml/badge.svg" />
    </a>

    <!-- Windows -->
    <a class="ci-card" href="https://github.com/Gerrrt/dotfiles-Windows/actions/workflows/ci.yml" target="_blank" rel="noopener">
      <div class="ci-card__head">
        <span class="ci-card__name">⊞ dotfiles-Windows</span>
        <span class="ci-card__layer tone-cyan">Native host</span>
      </div>
      <img class="ci-card__badge" loading="lazy" alt="dotfiles-Windows CI status"
        src="https://github.com/Gerrrt/dotfiles-Windows/actions/workflows/ci.yml/badge.svg" />
    </a>

    <!-- Kali -->
    <a class="ci-card" href="https://github.com/Gerrrt/dotfiles-Kali/actions/workflows/lint.yml" target="_blank" rel="noopener">
      <div class="ci-card__head">
        <span class="ci-card__name">⚔ dotfiles-Kali</span>
        <span class="ci-card__layer tone-red">Role / offensive</span>
      </div>
      <img class="ci-card__badge" loading="lazy" alt="dotfiles-Kali lint status"
        src="https://github.com/Gerrrt/dotfiles-Kali/actions/workflows/lint.yml/badge.svg" />
    </a>

    <!-- Fedora -->
    <a class="ci-card" href="https://github.com/Gerrrt/dotfiles-Fedora/actions/workflows/lint.yml" target="_blank" rel="noopener">
      <div class="ci-card__head">
        <span class="ci-card__name">◉ dotfiles-Fedora</span>
        <span class="ci-card__layer tone-blue">OS-native</span>
      </div>
      <img class="ci-card__badge" loading="lazy" alt="dotfiles-Fedora lint status"
        src="https://github.com/Gerrrt/dotfiles-Fedora/actions/workflows/lint.yml/badge.svg" />
    </a>

    <!-- Arch -->
    <a class="ci-card" href="https://github.com/Gerrrt/dotfiles-Arch/actions/workflows/lint.yml" target="_blank" rel="noopener">
      <div class="ci-card__head">
        <span class="ci-card__name">▲ dotfiles-Arch</span>
        <span class="ci-card__layer tone-blue">OS-native</span>
      </div>
      <img class="ci-card__badge" loading="lazy" alt="dotfiles-Arch lint status"
        src="https://github.com/Gerrrt/dotfiles-Arch/actions/workflows/lint.yml/badge.svg" />
    </a>

    <!-- openSUSE -->
    <a class="ci-card" href="https://github.com/Gerrrt/dotfiles-openSUSE/actions/workflows/lint.yml" target="_blank" rel="noopener">
      <div class="ci-card__head">
        <span class="ci-card__name">❖ dotfiles-openSUSE</span>
        <span class="ci-card__layer tone-blue">OS-native</span>
      </div>
      <img class="ci-card__badge" loading="lazy" alt="dotfiles-openSUSE lint status"
        src="https://github.com/Gerrrt/dotfiles-openSUSE/actions/workflows/lint.yml/badge.svg" />
    </a>

    <!-- Alpine -->
    <a class="ci-card" href="https://github.com/Gerrrt/dotfiles-Alpine/actions/workflows/lint.yml" target="_blank" rel="noopener">
      <div class="ci-card__head">
        <span class="ci-card__name">❄ dotfiles-Alpine</span>
        <span class="ci-card__layer tone-blue">OS-native</span>
      </div>
      <img class="ci-card__badge" loading="lazy" alt="dotfiles-Alpine lint status"
        src="https://github.com/Gerrrt/dotfiles-Alpine/actions/workflows/lint.yml/badge.svg" />
    </a>

    <!-- Gentoo -->
    <a class="ci-card" href="https://github.com/Gerrrt/dotfiles-Gentoo/actions/workflows/lint.yml" target="_blank" rel="noopener">
      <div class="ci-card__head">
        <span class="ci-card__name">◢ dotfiles-Gentoo</span>
        <span class="ci-card__layer tone-blue">OS-native</span>
      </div>
      <img class="ci-card__badge" loading="lazy" alt="dotfiles-Gentoo lint status"
        src="https://github.com/Gerrrt/dotfiles-Gentoo/actions/workflows/lint.yml/badge.svg" />
    </a>
  </div>
</section>

<style>
  .ci-badges {
    margin: 3rem 0;
  }
  .ci-badges__title {
    font-family: var(--font-mono);
    color: var(--tn-fg);
    margin: 0 0 0.35rem;
  }
  .ci-badges__lead {
    color: var(--text-muted);
    margin: 0 0 1.4rem;
  }
  .ci-badges__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 1rem;
  }
  .ci-card {
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
    padding: 1rem;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--tn-surface);
    text-decoration: none;
    transition: border-color 0.15s ease, transform 0.15s ease;
  }
  .ci-card:hover {
    border-color: var(--tn-border-bright);
    transform: translateY(-2px);
  }
  .ci-card__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .ci-card__name {
    font-family: var(--font-mono);
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--tn-fg);
  }
  .ci-card__layer {
    font-family: var(--font-mono);
    font-size: 0.66rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .ci-card__badge {
    height: 20px;
    align-self: flex-start;
  }
  /* Layer accent colors — mirror the site's tone-* palette. */
  .tone-purple { color: var(--tn-purple); }
  .tone-blue   { color: var(--tn-blue); }
  .tone-cyan   { color: var(--tn-cyan); }
  .tone-red    { color: var(--tn-red); }
</style>
```
