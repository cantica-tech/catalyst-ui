---
description: Add a role to an existing user's roles array in .criterion/IAM/users/users.json (additive — doesn't remove their other roles)
argument-hint: <name> <role>
---

Assign an additional role to an existing user. Full spec:
`.criterion/CODE-OF-CONDUCT.md` §2 and §4,
templates: `development-framework/templates/users.template.json`,
`development-framework/templates/roles.template.json`.
Input: $ARGUMENTS

1. Parse `$ARGUMENTS` as `<name> <role>`. If either is missing, ask for it.
2. If `<name>` has no entry in `.criterion/IAM/users/users.json`, refuse and point
   to `/user-add` instead.
3. If `<role>` isn't one of the roles listed in `.criterion/IAM/roles/roles.json`,
   ask whether to use an existing role or run `/role-add` for `<role>`
   first.
4. If `<name>`'s `roles` array already contains `<role>`, say so and make
   no change.
5. Otherwise append `<role>` to that array and report the result. Do not
   commit or push — leave changes unstaged unless the user asks
   otherwise.
