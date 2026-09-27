---
description: Read-only filter/report over development/journal.jsonl (never appends)
argument-hint: "[--since <date>] [--artifact <id>] [--actor <name>] [--rule <id>] [--verify]"
---

Query the journal. Full spec: `.criterion/CODE-OF-CONDUCT.md` §4/§9,
schema: `.criterion/rules/Rules-of-Rules.md` §12.
Input: $ARGUMENTS

1. If `.criterion/development/journal.jsonl` doesn't exist or is
   empty, say so rather than inventing history.
2. Read it as one JSON object per line. Paths in older entries may be
   bare (working-copy relative), `<repo>:path` or absolute — read them
   as their project-root-relative form.
3. Apply whichever filters were given: `--since` on `timestamp`,
   `--artifact` on `artifact`, `--actor` on `actor`, `--rule` on
   membership in `targets`.
4. Report the matching entries in timestamp order — command, actor,
   artifact, targets, and each entry's `intent`.
5. When the user asks about integrity (or passes `--verify`), also run
   `catalyst journal verify` and report its findings.
6. This command never writes to the journal itself.

`catalyst <args>` is `python3 .criterion/bin/catalyst.pyz <args>`
(`CODE-OF-CONDUCT.md` §4).
