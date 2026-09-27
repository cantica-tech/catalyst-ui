---
description: Delete a named roadmap, or retire it in place if any of its items are linked to real work
argument-hint: <name>
---

Delete or retire a named roadmap. Sources:
`.criterion/CODE-OF-CONDUCT.md` §4, template: the highest-versioned
`.criterion/development/roadmaps/templates/TEMPLATE-ROADMAP-vN.md`.
First run `catalyst spec roadmap-remove` and follow it: it prints this command's
part of `CODE-OF-CONDUCT.md` §4, the canonical text. Open the sources
above in full only when the spec points elsewhere or a judgment needs
the Rules-of-Rules sections they cite.
Input: $ARGUMENTS

1. Parse `$ARGUMENTS` as `<name>`. If missing, ask for it.
2. If `.criterion/development/roadmaps/<name>.md` doesn't exist, refuse and say so.
3. Read the file's Items table. If every row's `Linked` column is empty
   (`*(none)*`), delete the file and remove its row from
   `.criterion/development/roadmaps/roadmaps.md`; report that it was removed.
4. If any row has a non-empty `Linked` field, do **not** delete anything.
   Instead add a `**Retired:** <today>` field to the file, mark its
   `roadmaps.md` row `retired`, and leave every row and `RM-NNNNNN` ID
   exactly as they are. Tell the user it was retired, not removed,
   because deleting it would break a live `FEAT-`/`REQ-` cross-reference.
5. Journal it: `catalyst journal append --command /roadmap-remove --action retire
   --artifact <name> --intent "<goal>" --file <roadmap file> --file <roadmaps.md>`
   (a deleted file is recorded with `after: null`).
6. Report the result. Do not commit or push on your own: the working copy (`.criterion/`)
   and the product repository are committed only with the user's assent.

`catalyst <args>` is `python3 .criterion/bin/catalyst.pyz <args>`
(`CODE-OF-CONDUCT.md` §4).
