---
description: Add a new role definition to .criterion/IAM/roles/roles.json
argument-hint: <role> <actions>
---

Add a new role definition. Full spec:
`.criterion/CODE-OF-CONDUCT.md` §2 and §4,
template: `development-framework/templates/roles.template.json`.
Input: $ARGUMENTS

1. Parse `$ARGUMENTS` as `<role> <actions>` (`<actions>` is a list of
   commands/actions this role typically performs — comma-separated is
   fine, matching the shape of the existing entries in
   `.criterion/IAM/roles/roles.json`). If either is missing, ask for it.
2. If `.criterion/IAM/roles/roles.json` doesn't exist yet, create it from
   `development-framework/templates/roles.template.json` (filled in with
   its default agile-role mapping) first.
3. If `<role>` already has an entry, refuse and point to `/role-modify`
   instead.
4. Append a new object to the `roles` array: `{"name": "<role>",
   "actions": [<actions>]}`.
5. Report the result. Do not commit or push — leave changes unstaged
   unless the user asks otherwise.

Renaming or removing a role here never retroactively changes a
`Signed-off-by` value already recorded on an existing artifact.
