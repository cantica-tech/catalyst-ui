---
description: List artifacts, work items, rules, users, roles, or templates of a requested type
argument-hint: <type|all> [--filter key=value ...] [--type <template-type>]
---

List items of the requested type. Full spec:
`.criterion/CODE-OF-CONDUCT.md` §4.
Input: $ARGUMENTS

1. Resolve what's being asked for and read the relevant index/rule
   files. If `type` is `all`, inspect every supported collection.
2. Apply each `--filter key=value` (or `key="value*"`) across the
   selected collection.
3. If `type` is `template`, require `--type <template-type>` to identify
   which template family to inspect.
4. Report matching items. If none match, return an empty result rather
   than inventing matches.
