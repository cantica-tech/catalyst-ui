---
description: Add a role to an existing user's roles array in .criterion/IAM/users/users.json (additive — doesn't remove their other roles)
argument-hint: <name> <role>
---

Assign an additional role to an existing user. Sources:
`.criterion/CODE-OF-CONDUCT.md` §2 and §4,
templates: `.criterion/IAM/users/templates/TEMPLATE-USERS-vN.json` (the highest `N`),
`.criterion/IAM/roles/templates/TEMPLATE-ROLES-vN.json` (the highest `N`).
First run `catalyst spec user-assign-role` and follow it: it prints this command's
part of `CODE-OF-CONDUCT.md` §4, the canonical text. Open the sources
above in full only when the spec points elsewhere or a judgment needs
the Rules-of-Rules sections they cite.
Input: $ARGUMENTS

1. Parse `$ARGUMENTS` as `<name> <role>`. If either is missing, ask for it.
2. If `<name>` has no entry in `.criterion/IAM/users/users.json`, refuse and point
   to `/user-add` instead.
3. If `<role>` isn't one of the roles listed in `.criterion/IAM/roles/roles.json`,
   ask whether to use an existing role or run `/role-add` for `<role>`
   first.
4. If `<name>`'s `roles` array already contains `<role>`, say so and make
   no change.
5. Otherwise append `<role>` to that array.
6. Journal the write: `catalyst journal append --command /user-assign-role --action update
   --artifact "user <name>" --intent "<why>" --file .criterion/IAM/users/users.json`.
7. Report the result. Do not commit or push — leave changes unstaged
   unless the user asks otherwise.

`catalyst <args>` is `python3 .criterion/bin/catalyst.pyz <args>`
(`CODE-OF-CONDUCT.md` §4).
