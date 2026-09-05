---
description: List registered users from .criterion/IAM/users/users.json, optionally filtered by role or active status
argument-hint: "[--role <role>] [--active-only]"
---

List registered users. Full spec:
`.criterion/CODE-OF-CONDUCT.md` §2 and §4,
template: `development-framework/templates/users.template.json`.
Input: $ARGUMENTS

1. If `.criterion/IAM/users/users.json` doesn't exist, say so rather than
   inventing users.
2. Read its `users` array.
3. If `--role <role>` is given, keep only entries whose `roles` array
   contains that role.
4. If `--active-only` is given, keep only entries with `"active": true`.
5. Report the matching entries (name, roles, registered, active, notes).
   If none match, say so rather than inventing matches.
