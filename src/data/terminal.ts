// Curated command set for the in-browser terminal playground (src/pages/playground.astro).
//
// This is a SIMULATED shell — no VM, no WASM, no real filesystem. Each entry maps a
// command (or one of its aliases) to deterministic, canned output that mirrors what
// the REAL dotfiles stack would print. The alias names are taken verbatim from
// dotfiles-core/zsh/aliases.zsh so the demo stays honest: `ls`→eza, `cat`→bat,
// `cd`/`z`→zoxide, etc. Keep the set small but representative of the modern-CLI stack.
//
// Output is plain text with embedded ANSI SGR escape sequences (\x1b[…m) so xterm.js
// renders the Tokyo Night palette. A handful of helpers below keep the escapes readable.

import { metrics } from "./metrics";

const ESC = "\x1b[";
const R = `${ESC}0m`; // reset
// 24-bit truecolor foreground from a hex string — xterm.js renders these against the
// Tokyo Night theme we configure on the client. Falls back gracefully if unsupported.
function fg(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${ESC}38;2;${r};${g};${b}m`;
}
// Tokyo Night Storm palette (matches src/styles/global.css).
export const TN = {
  bg: "#1a1b26",
  bgDark: "#16161e",
  surface: "#1f2335",
  fg: "#c0caf5",
  comment: "#565f89",
  muted: "#737aa2",
  blue: "#7aa2f7",
  cyan: "#7dcfff",
  purple: "#bb9af7",
  green: "#9ece6a",
  teal: "#73daca",
  red: "#f7768e",
  orange: "#ff9e64",
  yellow: "#e0af68",
} as const;

const c = {
  fg: (s: string) => `${fg(TN.fg)}${s}${R}`,
  blue: (s: string) => `${fg(TN.blue)}${s}${R}`,
  cyan: (s: string) => `${fg(TN.cyan)}${s}${R}`,
  purple: (s: string) => `${fg(TN.purple)}${s}${R}`,
  green: (s: string) => `${fg(TN.green)}${s}${R}`,
  teal: (s: string) => `${fg(TN.teal)}${s}${R}`,
  red: (s: string) => `${fg(TN.red)}${s}${R}`,
  orange: (s: string) => `${fg(TN.orange)}${s}${R}`,
  yellow: (s: string) => `${fg(TN.yellow)}${s}${R}`,
  comment: (s: string) => `${fg(TN.comment)}${s}${R}`,
  muted: (s: string) => `${fg(TN.muted)}${s}${R}`,
  bold: (s: string) => `${ESC}1m${s}${R}`,
};

export interface CommandSpec {
  // The canonical command name (what `help` lists).
  name: string;
  // All tokens that invoke this output (the alias + the underlying tool, where the
  // dotfiles stack aliases one to the other).
  match: string[];
  // The real tool this maps to in the stack (shown in help).
  tool: string;
  // One-line description for the help banner.
  blurb: string;
  // Canned stdout. Receives the raw argument string (everything after the command).
  run: (args: string) => string;
}

// ── eza-style listing (ls / ll / la / lt) ───────────────────────────────────
// We avoid Nerd Font glyphs (unreliable in browsers); directories get a trailing
// slash and color instead of icons.
function ezaShort(): string {
  const dir = (s: string) => c.blue(c.bold(s));
  const exe = (s: string) => c.green(s);
  const file = (s: string) => c.fg(s);
  return [
    `${dir("core/")}        ${dir("offensive/")}   ${file("README.md")}      ${file("CHANGELOG.md")}`,
    `${dir("zsh/")}         ${dir("tmux/")}        ${exe("bootstrap.sh")}   ${file("core.manifest")}`,
    `${dir("nvim/")}        ${dir("scripts/")}     ${file("core.version")}   ${file("Makefile")}`,
  ].join("\r\n");
}
function ezaLong(): string {
  const row = (
    perm: string,
    size: string,
    date: string,
    name: string,
    paint: (s: string) => string,
    git = " ",
  ) =>
    `${c.comment(perm)}  ${c.green(size.padStart(5))}  ${c.yellow(date)}  ${c.purple(git)} ${paint(name)}`;
  return [
    row("drwxr-xr-x", "  -", "30 Jun 14:02", "core/", (s) => c.blue(c.bold(s)), "-"),
    row("drwxr-xr-x", "  -", "30 Jun 14:02", "zsh/", (s) => c.blue(c.bold(s)), "M"),
    row("drwxr-xr-x", "  -", "29 Jun 22:18", "nvim/", (s) => c.blue(c.bold(s)), "-"),
    row("drwxr-xr-x", "  -", "28 Jun 09:11", "tmux/", (s) => c.blue(c.bold(s)), "-"),
    row(".rwxr-xr-x", "4.1k", "30 Jun 14:02", "bootstrap.sh", (s) => c.green(s), "-"),
    row(".rw-r--r--", "1.2k", "30 Jun 14:02", "core.manifest", (s) => c.fg(s), "M"),
    row(".rw-r--r--", "   6", "30 Jun 14:02", "core.version", (s) => c.fg(s), "-"),
    row(".rw-r--r--", "7.0k", "29 Jun 22:18", "README.md", (s) => c.fg(s), "-"),
  ].join("\r\n");
}

// ── bat-style framed, line-numbered file view ────────────────────────────────
function bat(file: string, lines: string[], lang: string): string {
  const top = c.comment(`───────┬${"─".repeat(60)}`);
  const head = `${c.comment("       │")} ${c.fg(c.bold(file))}  ${c.comment(`[${lang}]`)}`;
  const sep = c.comment(`───────┼${"─".repeat(60)}`);
  const bottom = c.comment(`───────┴${"─".repeat(60)}`);
  const body = lines.map((l, i) => `${c.comment(`  ${String(i + 1).padStart(3)}  │`)} ${l}`);
  return [top, head, sep, ...body, bottom].join("\r\n");
}

// Source the version from generated.json (via metrics) so `cat core.version` in the
// playground can never drift from Core's real release — it's the same number the
// homepage metrics strip and changelog feed render. Falls back to "main" pre-release.
const CORE_VERSION = bat(
  "core.version",
  [c.orange((metrics.core.version ?? "main").replace(/^v/, ""))],
  "txt",
);
const ZSHRC = bat(
  ".zshrc",
  [
    `${c.comment("# Bootstrap the vendored Core module chain, then OS + local overlays.")}`,
    `${c.purple("source")} ${c.green('"$HOME/.config/zsh/core/zsh/loader.zsh"')}`,
    ``,
    `${c.comment("# Load order is load-bearing — see core.manifest:")}`,
    `${c.comment("#   tools -> ui -> options -> history -> aliases -> git -> functions")}`,
    `${c.comment("#   -> fzf -> bindings -> plugins -> op -> maint -> update -> os -> local")}`,
  ],
  "zsh",
);

// The README "files" the demo knows about — `cat`/`bat` and `ls` agree on this set.
const FILES: Record<string, string> = {
  "core.version": CORE_VERSION,
  ".zshrc": ZSHRC,
  zshrc: ZSHRC,
};

// ── the command table ────────────────────────────────────────────────────────
export const COMMANDS: CommandSpec[] = [
  {
    name: "ls",
    match: ["ls", "la", "lt", "eza"],
    tool: "eza",
    blurb: "list files — icons, git status, tree (aliased to eza)",
    run: () => ezaShort(),
  },
  {
    name: "ll",
    match: ["ll", "ll -a", "l"],
    tool: "eza -lah --git",
    blurb: "long listing with permissions, size, git column",
    run: () => ezaLong(),
  },
  {
    name: "cat",
    match: ["cat", "bat", "catp"],
    tool: "bat",
    blurb: "view a file — syntax-highlighted, framed (aliased to bat). Try: cat core.version",
    run: (args) => {
      const f = args.trim().split(/\s+/)[0] || "";
      if (!f) return c.muted("usage: cat <file>   (try: core.version, .zshrc)");
      const key = f.replace(/^\.\//, "");
      if (FILES[key]) return FILES[key];
      return `${c.red("cat:")} ${f}: ${c.muted("No such file. Known files: core.version, .zshrc")}`;
    },
  },
  {
    name: "z",
    match: ["z", "cd", "zi", "cdi"],
    tool: "zoxide",
    blurb: "smart cd — jump to a frecent dir by substring (aliased to zoxide)",
    run: (args) => {
      const target = args.trim() || "~";
      // The "jump" is the prompt change; echo the resolved dir like zoxide does in -v.
      const resolved =
        target === "~" || target === ""
          ? "~"
          : target.startsWith("/") || target.startsWith("~")
            ? target
            : `~/Projects/${target}`;
      return c.comment(`zoxide: jumped to ${resolved}`);
    },
  },
  {
    name: "fd",
    match: ["fd", "find"],
    tool: "fd",
    blurb: "fast, gitignore-aware file find (aliased to fd)",
    run: (args) => {
      const pat = args.trim() || "";
      const hits = [
        c.purple("zsh/aliases.zsh"),
        c.purple("zsh/tools.zsh"),
        c.purple("zsh/functions.zsh"),
        c.blue("nvim/init.lua"),
        c.green("bootstrap.sh"),
      ];
      const shown = pat ? hits.filter((h) => h.includes(pat)) : hits;
      return (shown.length ? shown : [c.muted(`(no matches for "${pat}")`)]).join("\r\n");
    },
  },
  {
    name: "rg",
    match: ["rg", "grep"],
    tool: "ripgrep --smart-case",
    blurb: "recursive search — smart-case by default. Try: rg alias",
    run: (args) => {
      const pat = args.trim() || "alias";
      return [
        `${c.purple("zsh/aliases.zsh")}`,
        `${c.green("10")}:${c.comment(":")}  ${c.fg("if [[ -n ${HAVE_EZA:-} ]]; then")}`,
        `${c.green("11")}:${c.comment(":")}    ${highlight(`alias ls='eza --group-directories-first --icons=auto'`, pat)}`,
        `${c.green("12")}:${c.comment(":")}    ${highlight(`alias ll='eza -lah --group-directories-first --git'`, pat)}`,
        `${c.purple("zsh/git.zsh")}`,
        `${c.green("4")}:${c.comment(":")}   ${highlight(`alias g='git'`, pat)}`,
      ].join("\r\n");
    },
  },
  {
    name: "git",
    match: ["git st", "git status", "gst", "g st"],
    tool: "git (st = status -sb)",
    blurb: "git short status — the `gst`/`git st` alias from git.zsh",
    run: () => {
      return [
        `${c.green("##")} ${c.fg("main")}${c.comment("...origin/main")}`,
        ` ${c.green("M")}  src/data/generated.json`,
        ` ${c.green("M")}  scripts/collect-metrics.mjs`,
        `${c.red("??")}  src/pages/playground.astro`,
      ].join("\r\n");
    },
  },
  {
    name: "help",
    match: ["help", "tldr"],
    tool: "tealdeer (tldr)",
    blurb: "community quick-reference for a command (aliased to tldr)",
    run: (args) => {
      const cmd = args.trim().split(/\s+/)[0];
      if (!cmd) return banner();
      const spec = lookup(cmd);
      if (!spec) {
        return `${c.muted(`No tldr page for "${cmd}". Try one of:`)} ${knownNames().join(", ")}`;
      }
      return [
        c.fg(c.bold(spec.name)),
        c.muted(spec.blurb),
        "",
        c.comment(`- backed by: ${spec.tool}`),
        c.comment(`- aliases:   ${spec.match.join(", ")}`),
      ].join("\r\n");
    },
  },
  {
    name: "welcome",
    match: ["welcome", "banner"],
    tool: "demo",
    blurb: "show the welcome banner",
    run: () => banner(),
  },
  {
    name: "clear",
    match: ["clear", "cls"],
    tool: "builtin",
    blurb: "clear the screen",
    run: () => "\0CLEAR", // sentinel handled by the client
  },
];

function highlight(line: string, pat: string): string {
  if (!pat) return c.fg(line);
  const idx = line.toLowerCase().indexOf(pat.toLowerCase());
  if (idx < 0) return c.fg(line);
  const before = line.slice(0, idx);
  const hit = line.slice(idx, idx + pat.length);
  const after = line.slice(idx + pat.length);
  return `${c.fg(before)}${c.red(c.bold(hit))}${c.fg(after)}`;
}

export function lookup(token: string): CommandSpec | undefined {
  const t = token.trim();
  return COMMANDS.find((s) => s.match.includes(t) || s.name === t);
}
export function knownNames(): string[] {
  return COMMANDS.map((s) => s.name);
}

export function banner(): string {
  const title = c.purple(c.bold("dotfiles")) + c.muted(" — interactive shell demo");
  const sub = c.comment("A simulated zsh with the real modern-CLI stack. Type a command:");
  const item = (cmd: string, desc: string) => `  ${c.cyan(cmd.padEnd(14))} ${c.muted(desc)}`;
  return [
    title,
    sub,
    "",
    item("ls", "eza listing (also: ll, la, lt)"),
    item("cat <file>", "bat view — try: cat core.version"),
    item("z <dir>", "zoxide jump (also: cd)"),
    item("fd <pat>", "find files     rg <pat>  search contents"),
    item("git st", "git short status"),
    item("help <cmd>", "tldr-style reference (also: help)"),
    item("clear", "clear the screen"),
    "",
    c.comment("This is a static, sandboxed simulation — no real shell, files, or network."),
  ].join("\r\n");
}

export function unknown(cmd: string): string {
  return [
    `${c.red("command not found:")} ${c.fg(cmd)}`,
    `${c.muted("try one of:")} ${knownNames().join(", ")}  ${c.muted("(or")} ${c.cyan("help")}${c.muted(")")}`,
  ].join("\r\n");
}

// The starship-style prompt the demo renders. Two-line, Tokyo-Night-tinted, using
// only ASCII so it renders without a Nerd Font. Mirrors the SHAPE of the real
// starship.toml prompt (dir segment + git branch segment) without its powerline glyphs.
export function prompt(dir = "~/dotfiles-core", branch = "main"): string {
  const d = `${ESC}48;2;41;46;66m${fg(TN.cyan)} ${dir} ${R}`;
  const g = `${ESC}48;2;31;35;53m${fg(TN.green)}  ${branch} ${R}`;
  return `${d}${g} ${fg(TN.purple)}❯${R} `;
}

// Re-export the color helpers for the client island (typed access to ANSI output).
export const ansi = { ...c, hex: fg, R };
