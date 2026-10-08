---
description: Edit a registered user's notes or reactivate them in .criterion/IAM/users/users.json (role changes go through /user-assign-role instead)
argument-hint: <name> <field> <value>
---

Edit a registered user's record. Sources:
`.criterion/CODE-OF-CONDUCT.md` §2 and §4,
template: `.criterion/IAM/users/templates/TEMPLATE-USERS-vN.json` (the highest `N`).
First run `catalyst spec user-modify` and follow it: it prints this command's
part of `CODE-OF-CONDUCT.md` §4, the canonical text. Open the sources
above in full only when the spec points elsewhere or a judgment needs
the Rules-of-Rules sections they cite.
Input: $ARGUMENTS

1. Parse `$ARGUMENTS` as `<name> <field> <value>`. If any part is
   missing, ask for it.
2. If `<name>` has no entry in `.criterion/IAM/users/users.json`, refuse and point
   to `/user-add`.
3. Only `notes` and `active` (`true`/`false`) are editable this way.
   - `<field>` = `roles`: refuse and point to `/user-assign-role`
     instead — role changes are additive, not a free-text edit.
   - `<field>` = `name` or `registered`: refuse — these are identity/audit
     fields and are never edited in place.
   - `<field>` = `active` set to `false`: point to `/user-remove` instead,
     since that command also checks the "at least one active user" rule.
4. Update the entry's `<field>` to `<value>`.
5. Journal the write: `catalyst journal append --command /user-modify --action update
   --artifact "user <name>" --intent "<why>" --file .criterion/IAM/users/users.json`.
6. Report the result. Do not commit or push — leave changes unstaged
   unless the user asks otherwise.

`catalyst <args>` is `python3 .criterion/bin/catalyst.pyz <args>`
(`CODE-OF-CONDUCT.md` §4).
