---
description: Edit a registered user's notes or reactivate them in .criterion/IAM/users/users.json (role changes go through /user-assign-role instead)
argument-hint: <name> <field> <value>
---

Edit a registered user's record. Full spec:
`.criterion/CODE-OF-CONDUCT.md` §2 and §4,
template: `development-framework/templates/users.template.json`.
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
4. Update the entry's `<field>` to `<value>` and report the result. Do
   not commit or push — leave changes unstaged unless the user asks
   otherwise.
