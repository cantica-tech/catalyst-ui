---
description: Update an artifact or work item's Status field
argument-hint: <artefact-id> <status> [force]
---

Update an artifact's `Status` field. Full spec:
`.criterion/CODE-OF-CONDUCT.md` §4.
Input: $ARGUMENTS

1. If the artifact ID doesn't resolve, say it cannot be found.
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
