---
description: Create a new requirement artifact and register it in requirements/requirements.md
argument-hint: <description> [--targets <rule-id>...] [--domain <CODE>]
---

Create a new requirement artifact. Full spec:
`.criterion/CODE-OF-CONDUCT.md` §3/§4, template:
`.criterion/requirements/templates/TEMPLATE-REQUIREMENT-v1.md`.
Input: $ARGUMENTS

1. Resolve the next `REQ-NNNNNN` ID from `requirements/requirements.md` + a
   directory listing of `requirements/` — never guess or reuse a number.
2. Must be vetted against every rule document (`Rules-of-Rules.md` §1) and
   always carries a `Domain` and `Targets`/proposed rule(s) — none of
   those three are optional. Ask for domain/target rule if not inferable.
3. Resolve who is signing this per §2 and fill `Signed-off-by`.
4. Copy the current `TEMPLATE-REQUIREMENT-vN.md`, fill every field, save as
   `requirements/REQ-NNNNNN-<short-summary>.md`.
5. Register it in `requirements/requirements.md`.
6. Report the result. Do not commit or push — leave changes unstaged
   unless the user asks otherwise.
