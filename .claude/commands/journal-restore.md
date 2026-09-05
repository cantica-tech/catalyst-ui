---
description: Reconstruct the tree as it stood at a given timestamp into a side directory (never touches the live tree)
argument-hint: <timestamp>
---

Point-in-time reconstruction from the journal. Full spec:
`.criterion/CODE-OF-CONDUCT.md` §9, mechanism:
`.criterion/rules/Rules-of-Rules.md` §12.
Input: $ARGUMENTS

1. Read `.criterion/development/journal.jsonl`. For every file path
   that appears in any entry with `timestamp <= <timestamp>`, take that
   path's `after` hash from its **latest** such entry.
2. Skip a path entirely if that latest `after` is `null` (the file didn't
   exist at that point).
3. Materialize each surviving path into a new side directory —
   `.criterion/.journal-restore/<timestamp>/` — via
   `git cat-file -p <hash> > <side-dir>/<path>`. **Never write into the
   live working tree.**
4. If a hash isn't retrievable from the git object store (never written
   with `-w`, or pruned), report that file as unrecoverable rather than
   silently omitting it.
5. Report the side directory's path and which files it contains.
