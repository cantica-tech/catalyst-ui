---
description: List artifacts, work items, rules, users, roles, or templates of a requested type
argument-hint: <type|all> [--filter key=value ...] [--type <template-type>]
---

List items of the requested type. Sources:
`.criterion/CODE-OF-CONDUCT.md` §4.
First run `catalyst spec list` and follow it: it prints this command's
part of `CODE-OF-CONDUCT.md` §4, the canonical text. Open the sources
above in full only when the spec points elsewhere or a judgment needs
the Rules-of-Rules sections they cite.
Input: $ARGUMENTS

1. Resolve what's being asked for and read the relevant index/rule
   files. If `type` is `all`, inspect every supported collection.
2. Apply each `--filter key=value` (or `key="value*"`) across the
   selected collection.
3. If `type` is `template`, require `--type <template-type>` to identify
   which template family to inspect.
4. Report matching items. If none match, return an empty result rather
   than inventing matches.
