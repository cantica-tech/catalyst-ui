---
description: Open and execute the analysis playbook to bootstrap rules from evidence
argument-hint: (no arguments)
---

Run the analysis playbook. Full spec: `.criterion/CODE-OF-CONDUCT.md`
§4. This framework's own repository content
(`development-framework/ANALYSIS-PLAYBOOK.md`), not part of the deployed
project — fetch it if not already available this session, referring to
it only by repository name, never a local path.
Input: $ARGUMENTS

1. If the playbook is missing, report that it's unavailable and do not
   invent missing content.
2. Otherwise open and execute `ANALYSIS-PLAYBOOK.md`'s steps against this
   deployment.
3. Return the resulting analysis summary.
