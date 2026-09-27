---
description: Summarize open work/blockers and regenerate development/BACKLOG.md and roadmap Status/Linked columns
argument-hint: (no arguments)
---

Refresh the backlog. Full spec: `.criterion/CODE-OF-CONDUCT.md` §4,
template: `.criterion/development/BACKLOG.md`.
Input: $ARGUMENTS

1. Inspect open bugs (by severity), in-progress/proposed requirements,
   work items with no linked `REQ-`/`BUG-` doc, rules with no open work
   targeting them, feature ideas with no requirement yet, and every
   non-retired `.criterion/development/roadmaps/<name>.md` (rows
   grouped by roadmap name then Status).
2. **Overwrite `.criterion/development/BACKLOG.md` in full** with the
   result and a refreshed timestamp — not optional.
3. **Also refresh every active roadmap file in place**: for each
   `RM-NNNNNN` row, resolve its `Linked` `FEAT-`/`REQ-` (if any) and set
   `Status` accordingly, leaving `Title`/`Notes`/`Source` untouched.
4. Report the same summary to the user in this turn.
