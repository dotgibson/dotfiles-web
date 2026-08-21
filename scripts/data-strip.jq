# data-strip.jq — what does NOT count as a change to the site's derived data.
# ──────────────────────────────────────────────────────────────────────────────
# ONE filter, read with `jq -f` by both data-freshness.yml (deciding whether to
# FAIL THE BUILD) and fleet-sync.yml (deciding whether to OPEN A REFRESH PR).
# Those two must never disagree about what counts as a change, or a green build
# sits beside an open "the data drifted" PR — or worse, the build stays green on
# drift the bot will not PR. The two workflows used to carry this expression
# character for character with a comment asking people to keep it that way; this
# file is that invariant made structural.
#
# generatedAt is a day-granular stamp and the commit fields track each source
# repo's HEAD; both move without the published content changing, so neither may
# turn a build red on its own.
#
# The type guard and the `?` are what let ONE filter cover all THREE stamp
# shapes:
#   • corpus.json / coverage.json carry a single generatedFrom.{repo,path,commit},
#     where .repos[]? matches nothing and this reduces exactly to the
#     del(.generatedAt, .generatedFrom.commit) it used to say.
#   • snippets.json carries generatedFrom.{clean,repos{}} — six SHAs, each moving
#     on every unrelated commit to its own repo — and generated.json carries that
#     same shape over eleven.
#   • snippets.json's generatedFrom has ALSO been the bare STRING "sibling
#     repos", and `del(.x.commit)` against a string is a hard jq error (exit 5),
#     which under `set -e` would break the bot outright. Guarding on the type
#     keeps one filter correct across all four shapes, the absent case included.
#
# Only the commit fields are stripped, NOT generatedFrom wholesale:
#   • .repo / .path are hardcoded in the corpus/coverage collectors, so they
#     change only when someone repoints a collector at a different source — a
#     change that must be committed, and which would otherwise slip through
#     whenever the new source happened to yield identical numbers.
#   • .clean, .unclean, .branch, .defaultBranch and .dirty are KEPT: in a fresh
#     shallow clone they are always true / absent / the default branch / false,
#     so they can only differ when the COMMITTED file was generated from a
#     feature branch or a dirty working tree. That is the local-publish accident
#     of 2026-08-16 in file form — real signal, not noise.
# ──────────────────────────────────────────────────────────────────────────────
del(.generatedAt)
| if (.generatedFrom | type) == "object"
  then del(.generatedFrom.commit, .generatedFrom.repos[]?.commit)
  else .
  end
