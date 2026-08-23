// Per-platform install guides. Each platform has ordered steps; each step has a
// short title, optional prose, and a code block (lang drives the prompt glyph).
export interface InstallStep {
  title: string;
  body?: string;
  code?: string;
  lang?: 'bash' | 'powershell';
}

export interface Platform {
  id: string;
  label: string;
  repo: string; // repo slug under the owner
  available: boolean; // false -> show "coming soon" note
  intro: string;
  steps: InstallStep[];
}

export const platforms: Platform[] = [
  {
    id: 'macos',
    label: 'macOS',
    repo: 'dotfiles-MacBook',
    available: true,
    intro: 'Apple Silicon or Intel. Homebrew does the heavy lifting; Core is vendored, so a clone is ready to go.',
    steps: [
      {
        title: 'Clone the repo',
        body: 'The Core layer is already vendored under core/ — no submodule flags.',
        code: 'git clone https://github.com/dotgibson/dotfiles-MacBook ~/dotfiles-MacBook\ncd ~/dotfiles-MacBook',
      },
      {
        title: 'Preview the plan (optional)',
        body: 'A dry run prints every symlink it would create and changes nothing.',
        code: './bootstrap.sh --links-only --dry-run',
      },
      {
        title: 'Provision + wire',
        body: 'Homebrew, brew bundle, then symlinks. Idempotent — re-run any time.',
        code: './bootstrap.sh\nexec zsh',
      },
      {
        title: 'Optional system prefs',
        body: 'Apply the opt-in macOS defaults (may require a logout).',
        code: './bootstrap.sh --macos-defaults',
      },
    ],
  },
  {
    id: 'windows',
    label: 'Windows',
    repo: 'dotfiles-Windows',
    available: true,
    intro: 'PowerShell 7 + Developer Mode (or run elevated) so symlinks work. The host layer only — WSL distros configure themselves.',
    steps: [
      {
        title: 'One-line bootstrap',
        body: 'Clones the repo and runs the installer. Needs git and pwsh 7+.',
        code: 'irm https://raw.githubusercontent.com/dotgibson/dotfiles-Windows/main/bootstrap.ps1 | iex',
        lang: 'powershell',
      },
      {
        title: 'Or install manually',
        body: 'Clone, then run the installer. -DryRun previews everything; -SkipPackages only re-wires links.',
        code: 'git clone https://github.com/dotgibson/dotfiles-Windows.git\ncd dotfiles-Windows\n.\\install.ps1',
        lang: 'powershell',
      },
      {
        title: 'Finish up',
        body: 'Open a new PowerShell window, set git identity, and apply mirrored WSL networking.',
        code: '# set name/email in ~/.gitconfig.local, then:\nwsl --shutdown',
        lang: 'powershell',
      },
    ],
  },
  {
    // A ROLE layer, so this guide is a TWO-REPO stack: the OS-native layer first,
    // then this on top. dotfiles-Offense owns no package manager, clipboard or paths.
    id: 'offense',
    label: 'Offense (role layer)',
    repo: 'dotfiles-Offense',
    available: true,
    intro:
      'The offensive role layer, stacked on an OS-native layer rather than replacing one. Kali is the box it is built for, and dotfiles-Debian provisions that — so this is two repos, in order. It installs nothing by default. Engagement data never lives in the repo.',
    steps: [
      {
        title: 'Install the OS-native layer first',
        body: 'dotfiles-Debian covers Ubuntu, Debian and Kali. Skip this step only if you already run one of the fleet’s OS layers.',
        code: 'git clone https://github.com/dotgibson/dotfiles-Debian ~/dotfiles-Debian\n~/dotfiles-Debian/bootstrap.sh',
      },
      {
        title: 'Clone the role layer',
        code: 'git clone https://github.com/dotgibson/dotfiles-Offense ~/dotfiles-Offense\ncd ~/dotfiles-Offense',
      },
      {
        title: 'Wire it, and see what you have',
        body: 'The default run creates the symlinks and reports which offensive tools are on $PATH, installed but unreachable, or missing. It installs nothing.',
        code: './bootstrap.sh\nexec zsh',
      },
      {
        title: 'Install the tool stack (opt-in)',
        body: 'On Kali this is apt from install/offensive-packages.txt. On any other Debian-family box it is a smaller portable subset via pipx and go — the rest of that list is Kali-packaged.',
        code: './bootstrap.sh --install',
      },
      {
        title: 'Apply WSL networking',
        body: 'Running Kali under WSL2? It is NAT’d — a listener isn’t reachable from your LAN until you enable mirrored networking on the Windows side. The example file ships in dotfiles-Debian.',
        code: '# drop wsl/windows.wslconfig.example at %UserProfile%\\.wslconfig, then from Windows:\nwsl.exe --shutdown',
      },
    ],
  },
  {
    // The BLUE mirror of the Offense guide, and a role layer on the same terms — the
    // OS-native layer goes on first. Unlike Offense this does not single out Kali:
    // the detection stack is containers, so any OS-native layer will do.
    id: 'defense',
    label: 'Defense (role layer)',
    repo: 'dotfiles-Defense',
    available: true,
    intro:
      'The defensive role layer — detection engineering and investigation, stacked on an OS-native layer rather than replacing one. Genuinely distro-agnostic: the heavy stack is containers, so you do not need Security Onion or any dedicated blue-team distro. It installs nothing. Case data never lives in the repo.',
    steps: [
      {
        title: 'Install the OS-native layer first',
        body: 'Any of the fleet’s OS layers works — this repo owns no package manager, clipboard or paths. Skip this step if you already run one.',
        code: 'git clone https://github.com/dotgibson/dotfiles-Fedora ~/dotfiles-Fedora\n~/dotfiles-Fedora/bootstrap.sh',
      },
      {
        title: 'Clone the role layer',
        code: 'git clone https://github.com/dotgibson/dotfiles-Defense ~/dotfiles-Defense\ncd ~/dotfiles-Defense',
      },
      {
        title: 'Wire it, and see what you have',
        body: 'The default run creates the symlinks, adds the defense stage to the loader, and probes for the forensics tools and Docker. It installs nothing. Use --dry-run first if you want the plan without the changes.',
        code: './bootstrap.sh\nexec zsh',
      },
      {
        title: 'Bring up the detection lab (opt-in)',
        body: 'The blue stack runs in containers from docker/detection-lab.compose.yml — siemup starts it detached, siemdown tears it down. Both need Docker; they are HAVE_*-guarded, so they simply say so when it is missing.',
        code: 'siemup\n# ... and when you are done:\nsiemdown',
      },
      {
        title: 'Open a case',
        body: 'mkcase scaffolds an investigation under ~/cases — outside the repo by design, exactly as dotfiles-Offense keeps engagements in ~/engagements. Version-controlled detection content (Sigma, Sysmon, Zeek/Suricata, SIEM) lives under detections/.',
        code: 'mkcase suspicious-powershell',
      },
    ],
  },
  {
    id: 'linux',
    label: 'Linux distros',
    repo: 'dotfiles-Fedora',
    available: true,
    intro:
      'Fedora is the template; Arch, Debian/Ubuntu/Kali, openSUSE, Alpine, and Gentoo are stamped from it — same structure every time, only the package manager and a few distro quirks change. Pick the repo for your distro; the flow below is identical across all of them. Debian/Ubuntu is the one with a twist: it targets a frozen LTS, so it installs more from pinned upstream assets than the rest.',
    steps: [
      {
        title: 'Clone your distro’s repo',
        body: 'Swap Fedora for Arch, Debian, openSUSE, Alpine, or Gentoo. Core is already vendored under core/, so the clone is self-contained.',
        code: 'git clone https://github.com/dotgibson/dotfiles-Fedora ~/dotfiles-Fedora\ncd ~/dotfiles-Fedora',
      },
      {
        title: 'Preview the plan (optional)',
        body:
          'A dry run prints every planned action and changes nothing — every distro repo supports it. Adding --links-only narrows the preview to the symlinks, leaving the package manager out of it. (On Alpine --dry-run already implies --links-only.)',
        code: './bootstrap.sh --links-only --dry-run',
      },
      {
        title: 'Provision + wire',
        body: 'Installs the distro package layer, then symlinks. Idempotent — re-run any time. exec zsh to land in the new shell.',
        code: './bootstrap.sh\nexec zsh',
      },
      {
        title: 'Per-distro flags',
        body:
          'Fedora / openSUSE: --no-flatpak skips Flatpak. Gentoo: --no-sync skips the slow emerge --sync on re-runs. Arch: a manual/minimal box needs the stage-0 prep in SETUP.md first (git, sudo, a UTF-8 locale). Alpine: run as root or with doas; enable the community repo. Debian/Ubuntu: the same repo also covers Kali rolling — --no-upgrade keeps apt-get update but skips full-upgrade, --no-unattended leaves automatic security updates off, and --force-os is needed on other derivatives like Mint or Pop!_OS.',
      },
    ],
  },
];
