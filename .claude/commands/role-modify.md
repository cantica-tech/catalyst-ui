---
description: Change an existing role's mapped actions in .criterion/IAM/roles/roles.json
argument-hint: <role> <actions>
---

Change an existing role's mapped actions. Sources:
`.criterion/CODE-OF-CONDUCT.md` §2 and §4,
template: `.criterion/IAM/roles/templates/TEMPLATE-ROLES-vN.json` (the highest `N`).
First run `catalyst spec role-modify` and follow it: it prints this command's
part of `CODE-OF-CONDUCT.md` §4, the canonical text. Open the sources
above in full only when the spec points elsewhere or a judgment needs
the Rules-of-Rules sections they cite.
Input: $ARGUMENTS

1. Parse `$ARGUMENTS` as `<role> <actions>`. If either is missing, ask
   for it.
2. If `<role>` has no entry in `.criterion/IAM/roles/roles.json`, refuse and point
   to `/role-add` instead.
3. Replace that entry's `actions` array with `<actions>`.
4. Journal the write: `catalyst journal append --command /role-modify --action update
   --artifact "role <role>" --intent "<why>" --file .criterion/IAM/roles/roles.json`.
5. Report the result. Do not commit or push — leave changes unstaged
   unless the user asks otherwise.

This never retroactively changes a `Signed-off-by` value already recorded
on an existing artifact — that value reflects who signed it under the
mapping in effect at the time.

`catalyst <args>` is `python3 .criterion/bin/catalyst.pyz <args>`
(`CODE-OF-CONDUCT.md` §4).
