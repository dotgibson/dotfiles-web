// Static install endpoint -> emitted as a plain-text file at `<base>/install`.
//
// WHY THIS IS A STATIC FILE, NOT A SERVER ROUTE
// ---------------------------------------------
// This site is built with `output: 'static'` and deployed to GitHub Pages, which
// serves files and IGNORES query strings — there is no request-time code, so a
// `?modules=…` API cannot exist here. Instead we ship ONE fixed launcher and move
// the "dynamic" part to where it can actually run: ARGUMENTS the operator passes to
// their own shell. That is exactly how rustup/starship/etc. do `curl … | sh`.
//
//   curl -fsSL https://gerrrt.github.io/dotfiles-web/install | bash -s -- --modules core,offensive
//   curl -fsSL https://gerrrt.github.io/dotfiles-web/install | MODULES=core bash
//
// On the MIME type: when you pipe into bash, neither curl nor bash inspects the
// Content-Type — bash just reads bytes from stdin. The `text/plain` header below is
// still correct hygiene (it stops a browser opening the URL from rendering/mangling
// it, and is honored by `astro dev`/`preview` and any non-Pages host), but it is not
// what makes piping work, and GitHub Pages sets its own type from the filename at
// serve time regardless. So the script must be valid whatever the header says.
//
// The script body is kept pristine in src/scripts/install.sh and imported verbatim
// (`?raw`) so bash `${VAR}` syntax is never mangled by JS template interpolation.
import type { APIRoute } from 'astro';
import script from '../scripts/install.sh?raw';

export const prerender = true;

export const GET: APIRoute = () =>
  new Response(script, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
    },
  });
