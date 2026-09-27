---
description: Register a new user in .criterion/IAM/users/users.json with an initial role from .criterion/IAM/roles/roles.json
argument-hint: <name> <role>
---

Register a new user. Full spec:
`.criterion/CODE-OF-CONDUCT.md` §2 and §4,
templates: `framework/kernel/templates/users.template.json`,
`framework/kernel/templates/roles.template.json`.
Input: $ARGUMENTS

1. Parse `$ARGUMENTS` as `<name> <role>`. If either is missing, ask for it.
2. If `.criterion/IAM/roles/roles.json` or `.criterion/IAM/users/users.json` doesn't exist
   yet, create them from
   `framework/kernel/templates/roles.template.json` (filled in with
   its default agile-role mapping) and
   `framework/kernel/templates/users.template.json` (`{"users": []}`)
   first.
3. If `<name>` already has an entry in `.criterion/IAM/users/users.json`, refuse
   and point to `/user-modify`/`/user-assign-role` instead.
4. If `<role>` isn't one of the roles listed in `.criterion/IAM/roles/roles.json`,
   ask whether to use an existing role or run `/role-add` for `<role>`
   first.
5. Generate a `userid` (`Rules-of-Rules.md` §11, INV-26): draw 8
   characters from `[A-Za-z0-9]` via a cryptographically-secure random
   source; redraw if the result contains no uppercase letter; check
   against every existing `userid` already in
   `.criterion/IAM/users/users.json`; redraw from scratch on any
   collision.
6. Append a new object to the `users` array in `.criterion/IAM/users/users.json`:
   `{"name": "<name>", "roles": ["<role>"], "registered": "<today>",
   "active": true, "notes": "", "userid": "<generated>"}`.
7. Report the result, including the assigned `userid`. If this is the
   project's first registered user, note that the hard "at least one
   active user" requirement is now satisfied.

Do not commit or push — leave changes unstaged unless the user asks
otherwise. This role model is advisory, not access control — catalyst has
no way to verify who is actually typing.
