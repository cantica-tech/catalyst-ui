---
description: Read-only filter/report over development/journal.jsonl (never appends)
argument-hint: "[--since <date>] [--artifact <id>] [--actor <name>] [--rule <id>]"
---

Query the journal. Full spec: `.criterion/CODE-OF-CONDUCT.md` §9,
schema: `.criterion/rules/Rules-of-Rules.md` §12.
Input: $ARGUMENTS

1. If `.criterion/development/journal.jsonl` doesn't exist or is
   empty, say so rather than inventing history.
2. Read it as one JSON object per line.
3. Apply whichever filters were given: `--since` on `timestamp`,
   `--artifact` on `artifact`, `--actor` on `actor`, `--rule` on
   membership in `targets`.
4. Report the matching entries in timestamp order — command, actor,
   artifact, targets, and each entry's `intent`.
5. This command never writes to the journal itself.
