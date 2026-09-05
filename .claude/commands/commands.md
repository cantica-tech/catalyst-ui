---
description: List every slash command available in this instance
argument-hint: "list [--filter ...]"
---

List available commands. Full spec:
`.criterion/CODE-OF-CONDUCT.md` §4.
Input: $ARGUMENTS

1. List every slash command documented in `.criterion/CODE-OF-CONDUCT.md`
   §4 — name, one-line purpose — sourced from there, never re-enumerated
   as a hand-maintained subset.
2. Apply `--filter` the same way `/list` does, if given.
3. If this session is working on catalyst's own repository
   (`development-framework/` present at the root) rather than a deployed
   project, also list catalyst-development-only commands that exist here
   but aren't part of the deployed set — `/dogfood` is the current
   example (see `.claude/commands/dogfood.md`).
4. `/help` with no argument delegates here for its command listing rather
   than re-describing it.
