---
description: Change an existing role's mapped actions in .criterion/IAM/roles/roles.json
argument-hint: <role> <actions>
---

Change an existing role's mapped actions. Full spec:
`.criterion/CODE-OF-CONDUCT.md` §2 and §4,
template: `development-framework/templates/roles.template.json`.
Input: $ARGUMENTS

1. Parse `$ARGUMENTS` as `<role> <actions>`. If either is missing, ask
   for it.
2. If `<role>` has no entry in `.criterion/IAM/roles/roles.json`, refuse and point
   to `/role-add` instead.
3. Replace that entry's `actions` array with `<actions>` and report the
   result.
4. Do not commit or push — leave changes unstaged unless the user asks
   otherwise.

This never retroactively changes a `Signed-off-by` value already recorded
on an existing artifact — that value reflects who signed it under the
mapping in effect at the time.
