---
description: Register a new user in .criterion/IAM/users/users.json with an initial role from .criterion/IAM/roles/roles.json
argument-hint: <name> <role>
---

Register a new user. Sources:
`.criterion/CODE-OF-CONDUCT.md` §2 and §4, templates: the highest-versioned
`.criterion/IAM/users/templates/TEMPLATE-USERS-vN.json` and
`.criterion/IAM/roles/templates/TEMPLATE-ROLES-vN.json`.
First run `catalyst spec user-add` and follow it: it prints this command's
part of `CODE-OF-CONDUCT.md` §4, the canonical text. Open the sources
above in full only when the spec points elsewhere or a judgment needs
the Rules-of-Rules sections they cite.
Input: $ARGUMENTS

1. Parse `$ARGUMENTS` as `<name> <role>`. If either is missing, ask for it.
2. If `.criterion/IAM/roles/roles.json` or `.criterion/IAM/users/users.json`
   doesn't exist yet, create them from those templates first.
3. If `<name>` already has an entry in `.criterion/IAM/users/users.json`, refuse
   and point to `/user-modify`/`/user-assign-role` instead.
4. If `<role>` isn't one of the roles listed in `.criterion/IAM/roles/roles.json`,
   ask whether to use an existing role or run `/role-add` for `<role>`
   first.
5. Draw the `userid` with `catalyst userid gen` (`Rules-of-Rules.md` §11,
   INV-26) — never by hand.
6. Append a new object to the `users` array in `.criterion/IAM/users/users.json`:
   `{"name": "<name>", "roles": ["<role>"], "registered": "<today>",
   "active": true, "notes": "", "userid": "<generated>"}`.
7. Journal the write: `catalyst journal append --command /user-add --action create
   --artifact "user <name>" --intent "<why>" --file .criterion/IAM/users/users.json`
   (add `--file .criterion/IAM/roles/roles.json` if step 2 created it).
8. Report the result, including the assigned `userid`. If this is the
   project's first registered user, note that the hard "at least one
   active user" requirement is now satisfied.

Do not commit or push — leave changes unstaged unless the user asks
otherwise. This role model is advisory, not access control — catalyst has
no way to verify who is actually typing.

`catalyst <args>` is `python3 .criterion/bin/catalyst.pyz <args>`
(`CODE-OF-CONDUCT.md` §4).
