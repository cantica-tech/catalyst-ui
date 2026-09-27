---
description: Create a new bug artifact and register it in bugs/bugs.md
argument-hint: <description> [--targets <rule-id>...] [--severity Critical|High|Medium|Low]
---

Create a new bug artifact. Full spec: `.criterion/CODE-OF-CONDUCT.md`
§3/§4, template: `.criterion/development/bugs/templates/TEMPLATE-BUG-v1.md`.
Input: $ARGUMENTS

1. Resolve the next `BUG-NNNNNN` ID from `bugs/bugs.md` + a directory
   listing of `bugs/` — never guess or reuse a number.
2. `Targets` is required and never empty (§1). If the domain/rule can't
   be inferred, ask for both before creating the artifact.
3. Resolve who is signing this per §2 and fill `Signed-off-by`.
4. Copy the current `TEMPLATE-BUG-vN.md`, fill every field, and save as
   `bugs/BUG-NNNNNN-<short-summary>.md` — never a bare ID.
5. Register it in `bugs/bugs.md`.
6. Report the result. Do not commit or push — leave changes unstaged
   unless the user asks otherwise.
