// Static install endpoint -> emitted as a plain-text file at `<base>/install.ps1`.
// The Windows mirror of src/pages/install.ts — same rationale: GitHub Pages is
// static, so selection is passed as PARAMETERS to pwsh, not a server query string.
//
// `irm <url> | iex` cannot forward arguments, so the script defaults to the Core
// install; to pass modules, fetch then invoke the scriptblock with parameters:
//
//   $s = irm https://gerrrt.github.io/dotfiles-web/install.ps1
//   & ([scriptblock]::Create($s)) -Modules core,psmux
//
// Body kept pristine in src/scripts/install.ps1 and imported verbatim (`?raw`).
import type { APIRoute } from 'astro';
import script from '../scripts/install.ps1?raw';

export const prerender = true;

export const GET: APIRoute = () =>
  new Response(script, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
    },
  });
