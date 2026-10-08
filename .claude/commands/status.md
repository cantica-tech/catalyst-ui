---
description: Update an artifact or work item's Status field
argument-hint: <artefact-id> <status> [force]
---

Update an artifact's `Status` field. Sources:
`.criterion/CODE-OF-CONDUCT.md` §4.
First run `catalyst spec status` and follow it: it prints this command's
part of `CODE-OF-CONDUCT.md` §4, the canonical text. Open the sources
above in full only when the spec points elsewhere or a judgment needs
the Rules-of-Rules sections they cite.
Input: $ARGUMENTS

1. If the artifact ID doesn't resolve, say it cannot be found. If it is a
   `RECON-` case, refuse — even with `force` — and point to `/reconcile`:
   its role gate (`Rules-of-Rules.md` §16) is the only way a
   reconciliation's `Status` changes.
2. If the supplied status is one its entity type definition allows,
   change it normally.
3. If invalid and `force` is supplied, change it to that value anyway.
4. If invalid and `force` is not supplied, refuse and do not modify the
   artifact.
5. After a change: `catalyst index regen`, then
   `catalyst journal append --command /status --action status-change
   --artifact <id> [--target <rule-id> ...] --intent "<why>" --file <artifact file>
   --file <each regenerated index>`.
6. Report the result. Do not commit or push.

`catalyst <args>` is `python3 .criterion/bin/catalyst.pyz <args>`
(`CODE-OF-CONDUCT.md` §4).
