---
description: List registered users from .criterion/IAM/users/users.json, optionally filtered by role or active status
argument-hint: "[--role <role>] [--active-only]"
---

List registered users. Sources:
`.criterion/CODE-OF-CONDUCT.md` §2 and §4,
template: `framework/kernel/templates/users.template.json`.
First run `catalyst spec user-list` and follow it: it prints this command's
part of `CODE-OF-CONDUCT.md` §4, the canonical text. Open the sources
above in full only when the spec points elsewhere or a judgment needs
the Rules-of-Rules sections they cite.
Input: $ARGUMENTS

1. If `.criterion/IAM/users/users.json` doesn't exist, say so rather than
   inventing users.
2. Read its `users` array.
3. If `--role <role>` is given, keep only entries whose `roles` array
   contains that role.
4. If `--active-only` is given, keep only entries with `"active": true`.
5. Report the matching entries (name, roles, registered, active, notes).
   If none match, say so rather than inventing matches.
