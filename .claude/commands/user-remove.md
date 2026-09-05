---
description: Deactivate a registered user in .criterion/IAM/users/users.json (never deletes the entry, so existing Signed-off-by references stay resolvable)
argument-hint: <name>
---

Deactivate a registered user. Full spec:
`.criterion/CODE-OF-CONDUCT.md` §2 and §4,
template: `development-framework/templates/users.template.json`.
Input: $ARGUMENTS

1. Parse `$ARGUMENTS` as `<name>`. If missing, ask for it.
2. If `<name>` has no entry in `.criterion/IAM/users/users.json`, refuse and say
   so.
3. If `<name>` is the only entry with `"active": true`, warn that
   deactivating them would leave the project with zero active users (a
   project must have at least one — hard rule) and ask for confirmation
   before proceeding, or suggest running `/user-add` for a replacement
   first.
4. Otherwise set that entry's `"active"` field to `false`. Never delete
   the entry — existing `Signed-off-by` references on already-signed
   artifacts must stay resolvable to a name that's still listed.
5. Report the result. Do not commit or push — leave changes unstaged
   unless the user asks otherwise.
