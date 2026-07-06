<!-- Back to top link -->
<a id="readme-top"></a>

<!-- Project Shields -->
<div align="center"><nobr>

[![dotgibson][dotgibson-shield]][dotgibson-url]<!--
-->[![CI][ci-shield]][ci-url]<!--
-->![Last Commit][lastcommit-shield]<!--
-->[![Contributors][contributors-shield]][contributors-url]<!--
-->[![Forks][forks-shield]][forks-url]<!--
-->[![Stargazers][stars-shield]][stars-url]<!--
-->[![Issues][issues-shield]][issues-url]<!--
-->[![MIT License][license-shield]][license-url]

</nobr></div>

<!-- PROJECT LOGO -->
<br />
<div align="center">
  <a href="https://github.com/dotgibson/">
    <img src="https://raw.githubusercontent.com/dotgibson/.github/main/profile/logo.png" alt="Logo" width="80" height="80">
  </a>

  <h3 align="center">🌐 dotfiles-web</h3>

  <p align="center">
    The public showcase and documentation hub for the whole system — Astro, Tokyo Night, GitHub Pages.
    <br />
    <a href="https://dotgibson.github.io/dotfiles-web/docs"><strong>Explore the docs »</strong></a>
    <br />
    <br />
    <a href="https://dotgibson.github.io/dotfiles-web/">View Demo</a>
    &middot;
    <a href="https://github.com/dotgibson/dotfiles-web/issues/new?labels=bug">Report Bug</a>
    &middot;
    <a href="https://github.com/dotgibson/dotfiles-web/issues/new?labels=enhancement">Request Feature</a>
  </p>
</div>

<!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about-the-project">About The Project</a>
      <ul>
        <li><a href="#languages">Languages</a></li>
        <li><a href="#tools">Tools</a></li>
      </ul>
    </li>
    <li><a href="#getting-started">Getting Started</a></li>
    <li><a href="#developing">Developing</a></li>
    <li><a href="#contributing">Contributing</a></li>
    <li><a href="#license">License</a></li>
    <li><a href="#contact">Contact</a></li>
  </ol>
</details>

<!-- ABOUT THE PROJECT -->
## About The Project

**`dotfiles-web` is the public showcase + documentation hub** for the
[dotgibson](https://github.com/dotgibson/) dotfiles system — a ten-repo,
three-layer terminal environment (Core → OS-native → Role). It **documents** the
system rather than configuring a machine, so it is **not** itself one of the three
layers. Built with [Astro](https://astro.build), themed in **Tokyo Night**, and
deployed to **GitHub Pages** at
[dotgibson.github.io/dotfiles-web](https://dotgibson.github.io/dotfiles-web/).

The site is data-driven and largely source-derived: the showcase cards, the
per-repo docs pages, the "by the numbers" strip, and the changelog are generated
from `src/data/*` and from the sibling repos — so the docs can't silently drift
from the code they describe.

| Page | Path | Purpose |
| --- | --- | --- |
| Landing | `/` | Hero, the three-layer model, the repo map, install |
| Getting started | `/getting-started` | Per-platform install guide |
| Architecture | `/architecture` | The layer model, subtree rationale, the loader, deep dives |
| Docs hub | `/docs` | Concepts, guides, reference, and a generated page per repo |
| Changelog | `/changelog` | A mirror of each repo's `CHANGELOG.md` |

### Languages

- [![TypeScript][typescript-shield]][typescript-url]
- [![Astro][astro-shield]][astro-url]
- [![JavaScript][javascript-shield]][javascript-url]

### Tools

- [![Astro][astro-shield]][astro-url]
- [![Node.js][node-shield]][node-url]
- [![GitHub Pages][pages-shield]][pages-url]

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- GETTING STARTED -->
## Getting Started

### Prerequisites

**Node.js** (with `npm`). The site is a standard Astro project — no global tooling
beyond that.

### Installation

```bash
git clone https://github.com/dotgibson/dotfiles-web ~/dotfiles-web
cd ~/dotfiles-web
npm install
npm run dev        # local dev server at http://localhost:4321/dotfiles-web
```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- DEVELOPING -->
## Developing

```bash
npm run dev        # local dev server
npm run build      # production build into dist/
npm run preview    # preview the production build
npm run check      # astro check (types + content collections)
```

Content is data-driven — edit these and the site updates:

- `src/data/site.ts` — site name, owner, nav, GitHub links
- `src/data/repos.ts` — the repository map / per-repo pages (prose + status)
- `src/data/install.ts` — per-platform install steps
- `src/content/docs/**/*.md` — the documentation hub pages

The "by the numbers" strip, per-card package counts, and the changelog are **not**
hand-typed — they come from `src/data/generated.json`, which
`scripts/collect-metrics.mjs` derives by reading the sibling repos. Regenerate and
commit it whenever a source repo changes:

```bash
npm run metrics    # checkout the sibling repos next to this one first
```

Pushing to `main` triggers `.github/workflows/deploy.yml` (Astro build → GitHub
Pages). A source repo can ping a rebuild via `repository_dispatch`; the token and
secret walkthrough lives in [`docs/WEBHOOK-SETUP.md`](docs/WEBHOOK-SETUP.md).

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- CONTRIBUTING -->
## Contributing

Because this site restates facts that live elsewhere — the repo count, the
three-layer model, per-platform install commands — it is the easiest place for
documentation to **drift** from reality.

1. **Treat the source-of-truth repos as canonical** and keep the site in step; the
   `/doc-audit` routine in `dotfiles-core` checks exactly this cross-repo
   consistency.
2. **Keep content in the data files** (`src/data/*`, `src/content/docs/*`) rather
   than hard-coding it into pages.
3. **Green the gate.** `npm run check` (0 errors) and `npm run build` before you
   push.

Bugs and ideas: open an
[issue](https://github.com/dotgibson/dotfiles-web/issues).

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- LICENSE -->
## License

Distributed under the MIT License. See [`LICENSE`](LICENSE) for more information.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- CONTACT -->
## Contact

Garrett Allen - [@gerrrrt](https://x.com/gerrrrt) - <garrettallen2@gmail.com> - [LinkedIn](https://linkedin.com/in/garrettallen2)

Project Link: [dotgibson](https://github.com/dotgibson/)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- Markdown Links & Images -->
[dotgibson-shield]: https://img.shields.io/github/v/release/dotgibson/dotfiles-core?style=flat-square&label=dotgibson&labelColor=181717&logo=data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAF1klEQVR4nLSWbUxT7RnHr9PT09MXSltaoC9QXkqR16Iwhb0Iw8VYYE7jPri5aBaZzpmFZbpolpn4QeMyM%2BM%2B7MVt0Q9LNJIlxCzqxGWS6aKAig51vBQKIi3QltpCS0%2Fbc879pD1N3%2Bnz4fG5Pl2977v%2F331d131f5%2BZrddWQZAgAgy9uCRlefICzT6GeIsP%2FXF15kahmu9JglGmLRQoRQdIQWgu77BuWGe%2Fo%2BOqym8odApaWomTT1%2Bl2HqirahaTuJ9kQMggkgYhDRGfRiQDZBi9fuf52%2BD7l1b3ZhRcmq%2FMnBHmibuO7fvWoTalVoDjQRwL8RGgEOtzB0MbtBDnkRjGR0AgTK%2BQfNukr1LKXlhXKZpJSxTKGoFSq9vf16tQ8%2FiEh094Vu0L449mLGMup20DRWuFYVCiFm%2BvU36nTbOlMB%2BnCDxIOBzhvv6nFpc3TS0dUKDRHzh1Jk9O8wlPYN326Oa%2FJobnN8shAOxqKjrdXa8WSnGKWPewR%2FuHLG5P8oKUFJHi%2FH19F6UKEQ%2BnbJap27%2B%2BtWR15VAHgLkV%2F%2F0xW6OuQCfNE4PgmyX6f0xZKYbJDuj43lmtoYqHU%2FaZdwNXr4eoUG51zqgw%2B%2FCtrbm0UCeRynBhqVj2YC4RNC%2FuqStbKkydAODzeO7%2B6QYTpnOIYgB729R729RY9DAGafb0wDOHLwAA5vKK1mJNFoCpsxeLLn%2Fy91uU359719%2FfVXL%2BSM35IzU9rcXciCcQujz0imOfbGhOB0jkGo2hFQBW7Quzr0Zzq6vyBT%2FuKY%2BHErfBmQWLK1Lhr6l1OkleCqC0poPb%2FuTwv3OrA8DPDhgkokgLmLX77o86kqcGJmaj5xjr1JWlAAr1Js75MDEGAAI%2B1mvWX%2F1JY29XmYDPS5ZoNsrM24si1xSh3%2FRbGBYlz%2F73g41ztqliqYv1onyVHgDocMjjXASAKycavlqnZBHa2ajcasjv%2B8MbAPhRV9nI5MezB41crIPPHWOW9Gtl9XhDDCMCokIqSwGQ4shvyucFhEQCnqlSdm9k%2BdKt6XM%2FqO7aof7t8YbIIW5SHdpVIhUTAOAP0L8bmM3MHgJwByidQCgnhSmAqOEYnQ8AgRBr%2FuUzKsgggIs3pyVCfkeTCgAmFtaNOgm39C%2F3511r2W8JYvIAJbIaAwQ3vKAEoVgRaTQIBYKxqxgMs6euvdUXiQDgeHd5rV7K1fb2kC2rOgaYghQBMJ5grI3HUGuuhQiNIOWq8sy%2FLTgCKplgT0ZtCyprWw7%2FvKCyNr6yQqYg8cim59a9KQDnwv84R1%2F99UwAzsMya4vxeOYLN7YePGG%2BcAPjxXS%2BoavknFfOlRTAh8nHKNqLa1v2ZwK6dxQZtHk5ahu3%2FcYmLsoh%2B%2FsUgN%2BztDQzEvkYFBurGnan%2FS1%2B1P98L1FbxLIPzh193X%2FtwbmjiGUBYHd5nVFRCABPlxdtfh%2B3LHGKxof%2Bqo90C6yj58yi9Tm1kWjr94ZXsGhTuDuynAx2z0245yY4X06Kf9HWFd0N%2BuPbsUR64%2B3a57Erig2qIoOIlJSUNE69GWTZRFufXvRNL%2Fo2ywyJE1fMP6xWqHBEP5yfvP7%2FbAAAsFufG01mkVCqkGvLyrbNTD2mw9kfDckmE0oudx9rUZfhiF5Zd%2F%2F00QDF0NkBTJhanB3e0riHJIRKhXarqWfdu%2Bx0WnOot1ftuNR90lhQzEO0L7B2YvCm3b%2BWNI%2ByffSLq757%2BPcquYaIvBtgdcXycuzO9MzTFdccd9IwDNMVlDaXbzPXtxsVhQRDEQzl8i6d%2Buf12Y%2BONDVMo6vOfHWJxHLz3l811u8WAEZABCNAAHSI8n8k2HABKRJjLJ8JECxFMAE%2BHXhiGb7yn35vcCNDKVsEcSuv%2BEpn%2B7Etla0CwAQIOBLBhrkt85kAnwm8mX95e%2FTOa9vUZiIxQI43r0Kura9uN5SYNMoyuVDGZ2nK73C65iy28Rezo44152bSKYAvz3ifVA1lDn0WAAD%2F%2F%2FWvXexgMwqgAAAAAElFTkSuQmCC
[dotgibson-url]: https://github.com/dotgibson/dotfiles-core/releases/latest
[ci-shield]: https://img.shields.io/github/actions/workflow/status/dotgibson/dotfiles-web/deploy.yml?branch=main&style=flat-square&logo=githubactions&logoColor=white&label=CI
[ci-url]: https://github.com/dotgibson/dotfiles-web/actions/workflows/deploy.yml
[lastcommit-shield]: https://img.shields.io/github/last-commit/dotgibson/dotfiles-web?branch=main&style=flat-square&logo=git&logoColor=white
[contributors-shield]: https://img.shields.io/github/contributors/dotgibson/dotfiles-web.svg?style=flat-square&logo=github
[contributors-url]: https://github.com/dotgibson/dotfiles-web/graphs/contributors
[forks-shield]: https://img.shields.io/github/forks/dotgibson/dotfiles-web.svg?style=flat-square&logo=github
[forks-url]: https://github.com/dotgibson/dotfiles-web/network/members
[stars-shield]: https://img.shields.io/github/stars/dotgibson/dotfiles-web.svg?style=flat-square&logo=github
[stars-url]: https://github.com/dotgibson/dotfiles-web/stargazers
[issues-shield]: https://img.shields.io/github/issues/dotgibson/dotfiles-web?style=flat-square&logo=github
[issues-url]: https://github.com/dotgibson/dotfiles-web/issues
[license-shield]: https://img.shields.io/github/license/dotgibson/dotfiles-web.svg?style=flat-square
[license-url]: https://github.com/dotgibson/dotfiles-web/blob/main/LICENSE
[typescript-shield]: https://img.shields.io/github/v/release/microsoft/TypeScript?style=flat-square&logo=typescript&logoColor=white&label=TypeScript&labelColor=3178C6&color=3D59A1
[typescript-url]: https://github.com/microsoft/TypeScript
[astro-shield]: https://img.shields.io/npm/v/astro?style=flat-square&logo=astro&logoColor=white&label=Astro&labelColor=BC52EE&color=3D59A1
[astro-url]: https://github.com/withastro/astro
[javascript-shield]: https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black
[javascript-url]: https://developer.mozilla.org/docs/Web/JavaScript
[node-shield]: https://img.shields.io/github/v/release/nodejs/node?style=flat-square&logo=nodedotjs&logoColor=white&label=Node.js&labelColor=5FA04E&color=3D59A1
[node-url]: https://github.com/nodejs/node
[pages-shield]: https://img.shields.io/badge/GitHub_Pages-222222?style=flat-square&logo=githubpages&logoColor=white
[pages-url]: https://pages.github.com
