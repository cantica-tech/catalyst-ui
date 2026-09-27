---
description: Fold a partial delta file into an existing named roadmap, without flagging items the delta omits
argument-hint: <name> <update file>
---

Fold a partial delta file into an existing named roadmap. Sources:
`.criterion/CODE-OF-CONDUCT.md` §4, template: the highest-versioned
`.criterion/development/roadmaps/templates/TEMPLATE-ROADMAP-vN.md`.
First run `catalyst spec roadmap-merge` and follow it: it prints this command's
part of `CODE-OF-CONDUCT.md` §4, the canonical text. Open the sources
above in full only when the spec points elsewhere or a judgment needs
the Rules-of-Rules sections they cite.
Input: $ARGUMENTS

1. Parse `$ARGUMENTS` as `<name> <update file>`. If either is missing, ask
   for it.
2. If `.criterion/development/roadmaps/<name>.md` doesn't exist, refuse and point to
   `/roadmap-add` instead.
3. Read `<update file>` and identify its distinct items.
4. For each item: if it matches an existing row by title/description
   similarity, update that row's `Title`/`Description`/`Notes` — ask the
   user rather than guessing when a match is ambiguous (never touch its
   `ID`, including its `userid` suffix — that stays fixed for the life
   of the row per `Rules-of-Rules.md` §20). If it doesn't match any
   existing row, add a new row: resolve who is signing this merge
   (`CODE-OF-CONDUCT.md` §2) and take the next global ID from
   `catalyst id next RM --as <signer>` (consecutive from there for
   several new rows in one write; the CLI refuses if the signer has no
   `userid` — register one first), with its own `Description`,
   `Status: Not triaged`, `Signed-off-by` the resolved signer.
5. Unlike `/roadmap-update`, do not compare against or flag any existing
   row that `<update file>` doesn't mention — it's a delta, not the full
   roadmap. Do not change the file's `Source` field; only update `Last
   updated` to today.
6. Journal it: `catalyst journal append --command /roadmap-merge --action update
   --artifact <name> --intent "<goal>" --file <roadmap file>`.
7. Report a short summary of what was added/updated. Do not commit or
   push — leave changes unstaged unless the user asks otherwise.

`catalyst <args>` is `python3 .criterion/bin/catalyst.pyz <args>`
(`CODE-OF-CONDUCT.md` §4).
