# data-stamps.jq — WHICH fleet commit each derived file says it was generated from.
# ──────────────────────────────────────────────────────────────────────────────
# ONE filter, read with `jq -s -f` over all four of src/data/*.json by both
# fleet-sync.yml (deciding whether the fleet has MOVED PAST the snapshot, and so
# whether to open a refresh PR) and data-freshness.yml (deciding WHICH COMMIT of
# each repo to clone before regenerating). It is the exact counterpart of
# data-strip.jq: that file says what does not count as a change, this one says
# what the committed data claims its sources were.
#
# Slurped, not per-file, because no single file names the whole fleet and the two
# stamp shapes are different:
#   • generated.json and snippets.json carry generatedFrom.repos{} — eleven repos
#     and six respectively, keyed by name, each with its own commit.
#   • corpus.json and coverage.json carry a flat generatedFrom.{repo,path,commit},
#     one source apiece (htpx and dotfiles-Defense).
# The union of the four is all twelve names in scripts/fleet-repos.txt, and htpx
# reaches it through corpus.json alone — which is why dropping either shape would
# silently lose a repo rather than fail.
#
# The type guard mirrors data-strip.jq's, and for the same reason: snippets.json's
# generatedFrom has historically been the bare STRING "sibling repos", and `.repos`
# against a string is a hard jq error (exit 5) that would break both callers under
# `set -e`. A file with no usable stamp contributes nothing and the caller decides
# what to do about the gap — fleet-sync treats an unstamped repo as moved, and
# data-freshness clones it at its default branch.
#
# ARGUMENT ORDER is load-bearing, so both callers pass the same one — snippets,
# coverage, corpus, generated. from_entries lets the LAST occurrence of a duplicate
# key win, and generated.json is the file to trust when two disagree: it stamps all
# eleven dotfiles repos where snippets.json stamps only its six curated sources. Two
# callers reading this filter in different orders could pin and poll different
# commits for the same repo, which is the one way they could still drift apart.
#
# PALETTE.JSON IS DELIBERATELY NOT PASSED TO THIS FILTER, and that is not an
# oversight to correct. It carries the same flat generatedFrom.{repo,path,commit}
# shape corpus and coverage use, so it WOULD parse — it would just key
# dotfiles-core, which generated.json already stamps, and this filter's whole
# contract is that the last writer of a duplicate key wins. Adding a fifth file
# that also claims Core would put a second authority for the fleet's Core pin into
# both callers at once, decided by argument order rather than by anything a reader
# could see. There is nothing to gain either: the palette adds no repo the other
# four do not already name, so the union of names is unchanged. It follows that a
# palette refresh alone never moves the pins — which is correct, because the pins
# exist to say which fleet commits to CLONE, and cloning Core at generated.json's
# commit is exactly what the palette check wants (see collect-palette.mjs on why a
# Core that predates theme/palette.toml is a warning and not a failure).
#
# `.commit // ""` rather than dropping a null: an unverifiable source (not a git
# checkout) stamps a null commit by design, and both callers need to SEE that name
# with an empty SHA — silently omitting the key would make an unverifiable repo
# look like one that simply is not in the fleet.
# ──────────────────────────────────────────────────────────────────────────────
map(if (.generatedFrom | type) == "object" then .generatedFrom else {} end)
| map(((.repos // {}) | to_entries | map({ key: .key, value: (.value.commit // "") }))
      + (if .repo then [{ key: .repo, value: (.commit // "") }] else [] end))
| add
| from_entries
