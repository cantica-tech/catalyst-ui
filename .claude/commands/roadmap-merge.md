---
description: Fold a partial delta file into an existing named roadmap, without flagging items the delta omits
argument-hint: <name> <update file>
---

Fold a partial delta file into an existing named roadmap. Full spec:
`.criterion/CODE-OF-CONDUCT.md` §4, template:
`.criterion/development/roadmaps/templates/TEMPLATE-ROADMAP-v1.md`.
Input: $ARGUMENTS

1. Parse `$ARGUMENTS` as `<name> <update file>`. If either is missing, ask
   for it.
2. If `.criterion/development/roadmaps/<name>.md` doesn't exist, refuse and point to
   `/roadmap-add` instead.
3. Read `<update file>` and identify its distinct items.
4. For each item: if it matches an existing row by title/description
   similarity, update that row's `Title`/`Notes` — ask the user rather
   than guessing when a match is ambiguous. If it doesn't match any
   existing row, add a new row (next global `RM-NNNNNN`, `Status: Not
   triaged`).
5. Unlike `/roadmap-update`, do not compare against or flag any existing
   row that `<update file>` doesn't mention — it's a delta, not the full
   roadmap. Do not change the file's `Source` field; only update `Last
   updated` to today.
6. Report a short summary of what was added/updated. Do not commit or
   push — leave changes unstaged unless the user asks otherwise.
