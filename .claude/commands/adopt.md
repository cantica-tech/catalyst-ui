---
description: List product changes committed outside catalyst and accept (journal) or reject each one
argument-hint: "[<commit> | <range>]"
---

Resolve the product changes that were written by hand, straight into git,
without a journal entry. Sources: `.criterion/CODE-OF-CONDUCT.md` §4 and
§9 ("Changes made outside catalyst"), mechanism:
`.criterion/rules/Rules-of-Rules.md` §12 and §16.
First run `catalyst spec adopt` and follow it: it prints this command's
part of `CODE-OF-CONDUCT.md` §4, the canonical text. Open the sources
above in full only when the spec points elsewhere or a judgment needs
the Rules-of-Rules sections they cite.
Input: $ARGUMENTS

1. `catalyst unrecorded $ARGUMENTS` lists each commit with its author and
   files. Nothing listed: report that and stop.
2. For each commit, show it (`git show --stat <commit>`) and ask the user
   to accept or reject it. Never decide for them.
3. Accept: state the tier (chore, fix, feature), do what the active
   module requires for it, then `catalyst journal adopt <commit> --intent
   "<why>" --tier <tier> [--target <ID>]`, oldest commit first.
4. Reject: propose `git revert <commit>`; run it only with the user's
   assent, and journal the revert like any other change.
5. Contested, or the actor may not decide it: open a `RECON-` case
   (`Trigger: unrecorded-change`) for `/reconcile` instead.
6. `catalyst check`, then report. Do not commit or push — leave changes
   unstaged unless the user asks otherwise (INV-4).

`catalyst <args>` is `python3 .criterion/bin/catalyst.pyz <args>`
(`CODE-OF-CONDUCT.md` §4).
