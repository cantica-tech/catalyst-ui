---
description: Verify that rules, domains, and artifact links remain consistent and don't conflict
argument-hint: (no arguments)
---

Check rule/domain/link consistency. Sources:
`.criterion/CODE-OF-CONDUCT.md` §4.
First run `catalyst spec check-rules` and follow it: it prints this command's
part of `CODE-OF-CONDUCT.md` §4, the canonical text. Open the sources
above in full only when the spec points elsewhere or a judgment needs
the Rules-of-Rules sections they cite.
Input: $ARGUMENTS

1. Run `catalyst check`: deployment structure, the traceability chain
   (missing rule targets, broken links, unindexed rules, signers, ID
   shapes), journal integrity and index freshness, as errors and
   warnings.
2. Then the judgment checks the CLI cannot make: rules that conflict with
   one another (`Rules-of-Rules.md` §1), domains that overlap or are
   misassigned, artifacts whose content no longer matches the rule they
   cite.
3. Report both parts. Never hand-edit an index to clear a finding —
   `catalyst index regen` does that.

`catalyst <args>` is `python3 .criterion/bin/catalyst.pyz <args>`
(`CODE-OF-CONDUCT.md` §4).
