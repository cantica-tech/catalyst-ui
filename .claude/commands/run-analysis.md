---
description: Four-eyes analysis of existing code — infer domains, rules and defects, each accepted by the user
argument-hint: "[<path>...] [--bootstrap|--incremental]"
---

Analyse existing code with the four-eyes process. Sources:
`.criterion/CODE-OF-CONDUCT.md` §4 (`/run-analysis`),
`.criterion/ANALYSIS-PLAYBOOK.md` (the phases, the pass and reconciliation
prompts, the findings format), commands: `catalyst analysis --help`.
First run `catalyst spec run-analysis` and follow it: it prints this command's
part of `CODE-OF-CONDUCT.md` §4, the canonical text. Then read
`.criterion/ANALYSIS-PLAYBOOK.md` in full.
Input: $ARGUMENTS

1. If `.criterion/ANALYSIS-PLAYBOOK.md` is missing, report that it is
   unavailable (`/sync-framework` restores it) and do not invent missing
   content.
2. Resolve the signer (`CODE-OF-CONDUCT.md` §2), then run the playbook's
   phases in order through `catalyst analysis` — start, two independent
   passes (separate agents or fresh sessions, the same prompt, launched
   together), diff, reconcile, decide, close. Never skip a phase or edit a
   report to get past the CLI.
3. Present every reconciled finding to the user and let them decide; write
   an artifact only after they accept it, then record the decision with its
   artifact ID.
4. Report the closed analysis's summary.
