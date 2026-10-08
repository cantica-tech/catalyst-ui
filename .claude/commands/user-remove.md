---
description: Deactivate a registered user in .criterion/IAM/users/users.json (never deletes the entry, so existing Signed-off-by references stay resolvable)
argument-hint: <name>
---

Deactivate a registered user. Sources:
`.criterion/CODE-OF-CONDUCT.md` §2 and §4,
template: `.criterion/IAM/users/templates/TEMPLATE-USERS-vN.json` (the highest `N`).
First run `catalyst spec user-remove` and follow it: it prints this command's
part of `CODE-OF-CONDUCT.md` §4, the canonical text. Open the sources
above in full only when the spec points elsewhere or a judgment needs
the Rules-of-Rules sections they cite.
Input: $ARGUMENTS

1. Parse `$ARGUMENTS` as `<name>`. If missing, ask for it.
2. If `<name>` has no entry in `.criterion/IAM/users/users.json`, refuse and say
   so.
3. If `<name>` is the only entry with `"active": true`, refuse —
   deactivating them would leave the project with zero active users (a
   project must have at least one — hard rule, INV-25's
   fundamental-invariant exception to acting without asking) — and point
   at `/user-add` for a replacement first.
4. Otherwise set that entry's `"active"` field to `false`. Never delete
   the entry — existing `Signed-off-by` references on already-signed
   artifacts must stay resolvable to a name that's still listed.
5. Journal the write: `catalyst journal append --command /user-remove --action update
   --artifact "user <name>" --intent "<why>" --file .criterion/IAM/users/users.json`.
6. Report the result. Do not commit or push — leave changes unstaged
   unless the user asks otherwise.

`catalyst <args>` is `python3 .criterion/bin/catalyst.pyz <args>`
(`CODE-OF-CONDUCT.md` §4).
