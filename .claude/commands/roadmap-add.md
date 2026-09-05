---
description: Ingest a new named roadmap from a local file into .criterion/development/roadmaps/
argument-hint: <name> <file>
---

Ingest a new named roadmap from a local file. Full spec:
`.criterion/CODE-OF-CONDUCT.md` §4, template:
`.criterion/development/roadmaps/templates/TEMPLATE-ROADMAP-v1.md`.
Input: $ARGUMENTS

1. Parse `$ARGUMENTS` as `<name> <file>`. If either is missing, ask for it.
2. If `.criterion/development/roadmaps/<name>.md` already exists, refuse and point to
   `/roadmap-update` or `/roadmap-merge` instead.
3. If `.criterion/development/roadmaps/` doesn't exist yet, create it, seed
   `.criterion/development/roadmaps/templates/TEMPLATE-ROADMAP-v1.md` from
   `development-framework/templates/roadmap.template.md`, and create an
   empty `.criterion/development/roadmaps/roadmaps.md` index.
4. Read `<file>` from the local filesystem and identify its distinct
   roadmap items (headings, bullets, table rows — whatever structure the
   source uses).
5. Determine the next `RM-NNNNNN` ID by scanning every existing
   `.criterion/development/roadmaps/*.md` file for the highest current number —
   never guess or reuse.
6. Create `.criterion/development/roadmaps/<name>.md` from
   `.criterion/development/roadmaps/templates/TEMPLATE-ROADMAP-v1.md`, with `Name: <name>`,
   `Source: <file>`, `Added`/`Last updated` set to today, and one row per
   identified item (`Status: Not triaged`, `Linked: *(none)*`).
7. Register `<name>` in `.criterion/development/roadmaps/roadmaps.md`.
8. Report the roadmap name and the IDs assigned. Do not commit or push —
   leave changes unstaged unless the user asks otherwise.
