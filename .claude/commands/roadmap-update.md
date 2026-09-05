---
description: Re-ingest a file as the new full, authoritative version of an existing named roadmap
argument-hint: <name> <file>
---

Re-ingest a local file as the new full version of an existing named
roadmap. Full spec: `.criterion/CODE-OF-CONDUCT.md`
§4, template: `.criterion/development/roadmaps/templates/TEMPLATE-ROADMAP-v1.md`.
Input: $ARGUMENTS

1. Parse `$ARGUMENTS` as `<name> <file>`. If either is missing, ask for it.
2. If `.criterion/development/roadmaps/<name>.md` doesn't exist, refuse and point to
   `/roadmap-add` instead.
3. Read `<file>` and identify its distinct items.
4. For each item: if it matches an existing row by title/description
   similarity, update that row's `Title`/`Notes` — ask the user rather
   than guessing when a match is ambiguous. If it doesn't match any
   existing row, add a new row (next global `RM-NNNNNN`, `Status: Not
   triaged`).
5. For each existing row whose item no longer appears in `<file>`, flag it
   in `Notes` (e.g. "no longer present in latest source as of <date>") —
   never delete the row.
6. Update the file's `Source` and `Last updated` fields to `<file>` and
   today.
7. Report a short summary of what was added/updated/flagged. Do not
   commit or push — leave changes unstaged unless the user asks otherwise.
