#!/usr/bin/env bash
# dotfiles — universal bootstrap launcher (https://github.com/Gerrrt)
#
# Served as a STATIC file from the showcase site. Module selection is read from the
# ARGUMENTS you pass to your shell (a static host has no server-side query string):
#
#   curl -fsSL https://gerrrt.github.io/dotfiles-web/install | bash -s -- --modules core,offensive
#   curl -fsSL https://gerrrt.github.io/dotfiles-web/install | MODULES=core bash
#
# Flags:
#   --modules a,b   comma-separated component set (default: core)
#   --dry-run       preview the symlink plan, change nothing (--links-only --dry-run)
#   --dest DIR      where to clone the repo (default: $HOME)
#   -h, --help      show this header
#
# Review before you run. You can always read this file first:
#   curl -fsSL https://gerrrt.github.io/dotfiles-web/install | less
set -euo pipefail

# Static usage block. Printed for -h/--help. Deliberately NOT read from "$0": under
# the primary `curl … | bash -s -- …` usage the script has no on-disk path, so a
# "$0"-based reader would print nothing.
usage() {
  cat <<'EOF'
dotfiles installer — universal bootstrap launcher

USAGE
  curl -fsSL https://gerrrt.github.io/dotfiles-web/install | bash -s -- [flags]
  curl -fsSL https://gerrrt.github.io/dotfiles-web/install | MODULES=core bash

FLAGS
  --modules a,b   comma-separated component set (default: core; e.g. core,offensive)
  --dry-run       preview the symlink plan, change nothing (--links-only --dry-run)
  --dest DIR      where to clone the repo (default: $HOME)
  -h, --help      show this help and exit

The launcher auto-detects your OS, clones the matching repo from the fleet, and
runs its bootstrap. Selecting 'offensive' targets the Kali offensive role layer.
EOF
}

OWNER="Gerrrt"
MODULES="${MODULES:-core}"
DEST="${DEST:-$HOME}"
DRY_RUN=0

while [ "$#" -gt 0 ]; do
  case "$1" in
    --modules)   MODULES="${2:-}"; shift 2 ;;
    --modules=*) MODULES="${1#*=}"; shift ;;
    --dest)      DEST="${2:-}"; shift 2 ;;
    --dest=*)    DEST="${1#*=}"; shift ;;
    --dry-run)   DRY_RUN=1; shift ;;
    -h|--help)   usage; exit 0 ;;
    *)           printf 'install: ignoring unknown argument: %s\n' "$1" >&2; shift ;;
  esac
done

# The value only ever drives string comparisons below, but validate it anyway so a
# typo fails loudly instead of silently selecting nothing.
if ! printf '%s' "$MODULES" | grep -Eq '^[a-z0-9]+(,[a-z0-9]+)*$'; then
  printf 'install: invalid --modules value: %q (expected e.g. core,offensive)\n' "$MODULES" >&2
  exit 2
fi

has_module() { case ",$MODULES," in *,"$1",*) return 0 ;; *) return 1 ;; esac; }

# Map the host OS to the matching repo in the fleet. The offensive role layer lives
# only on the Kali (Debian-family/apt) node, so requesting it selects that repo.
detect_repo() {
  if [ "$(uname -s)" = "Darwin" ]; then echo "dotfiles-MacBook"; return; fi
  if has_module offensive; then echo "dotfiles-Kali"; return; fi
  local id=""
  if [ -r /etc/os-release ]; then
    # shellcheck disable=SC1091
    . /etc/os-release
    id="${ID:-}"
  fi
  case "$id" in
    fedora|rhel|centos|rocky|almalinux) echo "dotfiles-Fedora" ;;
    arch|endeavouros|manjaro)           echo "dotfiles-Arch" ;;
    opensuse*|suse|sles|sled)           echo "dotfiles-openSUSE" ;;
    alpine)                             echo "dotfiles-Alpine" ;;
    gentoo)                             echo "dotfiles-Gentoo" ;;
    kali|debian|ubuntu)                 echo "dotfiles-Kali" ;;
    *)                                  echo "dotfiles-Fedora" ;;
  esac
}

REPO="$(detect_repo)"
URL="https://github.com/$OWNER/$REPO"
TARGET="$DEST/$REPO"

echo "🤖 dotfiles installer"
echo "   modules : $MODULES"
echo "   repo    : $REPO"
echo "   target  : $TARGET"
[ "$DRY_RUN" -eq 1 ] && echo "   mode    : dry run (no changes will be made)"
has_module offensive && echo "   note    : offensive role layer requested (Kali)"
echo

command -v git >/dev/null 2>&1 || { echo "install: git is required but not found on PATH" >&2; exit 1; }

# Translate the module/flag selection into bootstrap arguments.
bootstrap_args=()
if [ "$REPO" = "dotfiles-Kali" ] && ! has_module offensive; then
  bootstrap_args+=(--no-offensive)
fi
if [ "$DRY_RUN" -eq 1 ]; then
  bootstrap_args+=(--links-only --dry-run)
fi

if [ -d "$TARGET/.git" ]; then
  echo "📂 $TARGET already exists — updating"
  git -C "$TARGET" pull --ff-only
else
  echo "📦 cloning $URL"
  git clone --depth 1 "$URL" "$TARGET"
fi

cd "$TARGET"
if [ ! -x ./bootstrap.sh ]; then
  echo "install: $TARGET/bootstrap.sh not found or not executable" >&2
  exit 1
fi

# Expand the array safely under 'set -u' on bash 3.2 (macOS stock) too.
if [ "${#bootstrap_args[@]}" -gt 0 ]; then
  echo "⚙️  ./bootstrap.sh ${bootstrap_args[*]}"
  ./bootstrap.sh "${bootstrap_args[@]}"
else
  echo "⚙️  ./bootstrap.sh"
  ./bootstrap.sh
fi

echo
echo "✅ done. Open a new shell (or run: exec zsh) to land in your configured environment."
