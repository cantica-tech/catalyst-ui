---
description: Create a new bug artifact and register it in bugs/bugs.md
argument-hint: <description> [--targets <rule-id>...] [--severity Critical|High|Medium|Low]
---

Create a new bug artifact. Sources: `.criterion/CODE-OF-CONDUCT.md`
§3/§4, template: the highest-versioned
`.criterion/development/bugs/templates/TEMPLATE-BUG-vN.md`.
First run `catalyst spec create-bug` and follow it: it prints this command's
part of `CODE-OF-CONDUCT.md` §4, the canonical text. Open the sources
above in full only when the spec points elsewhere or a judgment needs
the Rules-of-Rules sections they cite.
Input: $ARGUMENTS

1. `Targets` is required and never empty (§1). If the domain/rule can't
   be inferred, ask for both before creating the artifact.
2. Resolve who is signing this per §2 and fill `Signed-off-by`.
3. Allocate the ID with `catalyst id next BUG --as <signer>` — never
   guess, compute by hand, or reuse a number.
4. Copy the current `TEMPLATE-BUG-vN.md`, fill every field, and save as
   `bugs/<ID>-<short-summary>.md` — never a bare ID.
5. Register it: `catalyst index regen` rebuilds `bugs/bugs.md`.
6. Journal it: `catalyst journal append --command /create-bug --action create
   --artifact <ID> --target <rule-id> ... --intent "<goal>" --file <each touched file>`.
7. Report the result. Do not commit or push — leave changes unstaged
   unless the user asks otherwise.

`catalyst <args>` is `python3 .criterion/bin/catalyst.pyz <args>`
(`CODE-OF-CONDUCT.md` §4).
