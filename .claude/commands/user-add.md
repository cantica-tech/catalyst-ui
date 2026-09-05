---
description: Register a new user in .criterion/IAM/users/users.json with an initial role from .criterion/IAM/roles/roles.json
argument-hint: <name> <role>
---

Register a new user. Full spec:
`.criterion/CODE-OF-CONDUCT.md` §2 and §4,
templates: `development-framework/templates/users.template.json`,
`development-framework/templates/roles.template.json`.
Input: $ARGUMENTS

1. Parse `$ARGUMENTS` as `<name> <role>`. If either is missing, ask for it.
2. If `.criterion/IAM/roles/roles.json` or `.criterion/IAM/users/users.json` doesn't exist
   yet, create them from
   `development-framework/templates/roles.template.json` (filled in with
   its default agile-role mapping) and
   `development-framework/templates/users.template.json` (`{"users": []}`)
   first.
3. If `<name>` already has an entry in `.criterion/IAM/users/users.json`, refuse
   and point to `/user-modify`/`/user-assign-role` instead.
4. If `<role>` isn't one of the roles listed in `.criterion/IAM/roles/roles.json`,
   ask whether to use an existing role or run `/role-add` for `<role>`
   first.
5. Append a new object to the `users` array in `.criterion/IAM/users/users.json`:
   `{"name": "<name>", "roles": ["<role>"], "registered": "<today>",
   "active": true, "notes": ""}`.
6. Report the result. If this is the project's first registered user,
   note that the hard "at least one active user" requirement is now
   satisfied.

Do not commit or push — leave changes unstaged unless the user asks
otherwise. This role model is advisory, not access control — catalyst has
no way to verify who is actually typing.
