---
description: Delete a named roadmap, or retire it in place if any of its items are linked to real work
argument-hint: <name>
---

Delete or retire a named roadmap. Full spec:
`.criterion/CODE-OF-CONDUCT.md` §4, template:
`.criterion/development/roadmaps/templates/TEMPLATE-ROADMAP-v1.md`.
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
5. Report the result. Do not commit or push — leave changes unstaged
   unless the user asks otherwise.
