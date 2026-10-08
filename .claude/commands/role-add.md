---
description: Add a new role definition to .criterion/IAM/roles/roles.json
argument-hint: <role> <actions> [full|propose|none]
---

Add a new role definition. Sources:
`.criterion/CODE-OF-CONDUCT.md` §2 and §4,
template: `.criterion/IAM/roles/templates/TEMPLATE-ROLES-vN.json` (the highest `N`).
First run `catalyst spec role-add` and follow it: it prints this command's
part of `CODE-OF-CONDUCT.md` §4, the canonical text. Open the sources
above in full only when the spec points elsewhere or a judgment needs
the Rules-of-Rules sections they cite.
Input: $ARGUMENTS

1. Parse `$ARGUMENTS` as `<role> <actions> [<reconciliation>]`
   (`<actions>` is a list of commands/actions this role typically
   performs — comma-separated is fine, matching the shape of the existing
   entries in `.criterion/IAM/roles/roles.json`; `<reconciliation>` is
   `full`, `propose` or `none`, `Rules-of-Rules.md` §16). If `<role>` or
   `<actions>` is missing, ask for it. If `<reconciliation>` is missing,
   use `propose` — never silently `full` — and say so in the report.
2. If `.criterion/IAM/roles/roles.json` doesn't exist yet, create it from
   the template above first.
3. If `<role>` already has an entry, refuse and point to `/role-modify`
   instead.
4. Append a new object to the `roles` array: `{"name": "<role>",
   "actions": [<actions>], "reconciliation": "<reconciliation>"}`.
5. Journal the write: `catalyst journal append --command /role-add
   --action create --artifact "role <role>" --intent "<why>"
   --file .criterion/IAM/roles/roles.json`.
6. Report the result. Do not commit or push — leave changes unstaged
   unless the user asks otherwise.

Renaming or removing a role here never retroactively changes a
`Signed-off-by` value already recorded on an existing artifact.

`catalyst <args>` is `python3 .criterion/bin/catalyst.pyz <args>`
(`CODE-OF-CONDUCT.md` §4).
