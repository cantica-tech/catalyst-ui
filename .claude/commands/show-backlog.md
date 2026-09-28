---
description: Summarize open work/blockers and regenerate development/BACKLOG.md and roadmap Status/Linked columns
argument-hint: (no arguments)
---

Refresh the backlog. Sources: `.criterion/CODE-OF-CONDUCT.md` §4,
template: `.criterion/development/BACKLOG.md`.
First run `catalyst spec show-backlog` and follow it: it prints this command's
part of `CODE-OF-CONDUCT.md` §4, the canonical text. Open the sources
above in full only when the spec points elsewhere or a judgment needs
the Rules-of-Rules sections they cite.
Input: $ARGUMENTS

1. Run `catalyst index regen` first, so every entity index reflects the
   artifact files, then read open bugs (Status `Open`/`Under Review`/`Fixed`, by
   severity), open requirements (Status `Draft`/`Proposed`/`Vetted`/`Active`), work items with no linked `REQ-`/`BUG-` doc, rules with
   no open work targeting them, feature ideas with no requirement yet, and
   every non-retired `.criterion/development/roadmaps/<name>.md` (rows
   grouped by roadmap name then Status).
2. **Overwrite `.criterion/development/BACKLOG.md` in full** with the
   result and a refreshed timestamp — not optional.
3. **Also refresh every active roadmap file in place**: for each
   `RM-NNNNNN` row, resolve its `Linked` `FEAT-`/`REQ-` (if any) and set
   `Status` accordingly (`Not triaged` / `Triaged` / `In progress` /
   `Done`, `Done` once every linked `REQ-` is `Completed` or `Abandoned`), leaving `Title`/`Notes`/`Source` untouched.
4. If any roadmap row's `Status` changed, journal it:
   `catalyst journal append --command /show-backlog --action status-change
   --artifact <name> --intent "<goal>" --file <each changed roadmap file>`.
5. Report the same summary to the user in this turn. Do not commit or
   push on your own: the working copy (`.criterion/`) and the product
   repository are committed only with the user's assent.

`catalyst <args>` is `python3 .criterion/bin/catalyst.pyz <args>`
(`CODE-OF-CONDUCT.md` §4).
