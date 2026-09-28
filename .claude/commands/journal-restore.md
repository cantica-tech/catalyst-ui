---
description: Reconstruct the tree as it stood at a given timestamp into a side directory (never touches the live tree)
argument-hint: <timestamp>
---

Point-in-time reconstruction from the journal. Sources:
`.criterion/CODE-OF-CONDUCT.md` §4/§9, mechanism:
`.criterion/rules/Rules-of-Rules.md` §12.
First run `catalyst spec journal-restore` and follow it: it prints this command's
part of `CODE-OF-CONDUCT.md` §4, the canonical text. Open the sources
above in full only when the spec points elsewhere or a judgment needs
the Rules-of-Rules sections they cite.
Input: $ARGUMENTS

1. Parse `<timestamp>` as ISO 8601 UTC (e.g. `2026-09-27T18:00:00Z`); ask
   if it is missing or ambiguous.
2. Run `catalyst journal restore <timestamp> .criterion/.journal-restore/<timestamp>/`
   — it materialises every journaled file as of that time into the side
   directory and **never writes into the live working tree** (the
   directory must be absent or empty).
3. Report every path the CLI lists as a missing blob as unrecoverable,
   rather than silently omitting it.
4. Report the side directory's path and which files it contains.

`catalyst <args>` is `python3 .criterion/bin/catalyst.pyz <args>`
(`CODE-OF-CONDUCT.md` §4).
