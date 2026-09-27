---
description: Create a new requirement artifact and register it in requirements/requirements.md
argument-hint: <description> [--targets <rule-id>...] [--domain <CODE>]
---

Create a new requirement artifact. Full spec:
`.criterion/CODE-OF-CONDUCT.md` §3/§4, template: the highest-versioned
`.criterion/requirements/templates/TEMPLATE-REQUIREMENT-vN.md`.
Input: $ARGUMENTS

1. Must be vetted against every rule document (`Rules-of-Rules.md` §1) and
   always carries a `Domain` and `Targets`/proposed rule(s) — none of
   those three are optional. Ask for domain/target rule if not inferable.
2. Resolve who is signing this per §2 and fill `Signed-off-by`.
3. Allocate the ID with `catalyst id next REQ --as <signer>` — never
   guess, compute by hand, or reuse a number.
4. Copy the current `TEMPLATE-REQUIREMENT-vN.md`, fill every field, save as
   `requirements/<ID>-<short-summary>.md`.
5. Register it: `catalyst index regen` rebuilds `requirements/requirements.md`.
6. Journal it: `catalyst journal append --command /create-req --action create
   --artifact <ID> --target <rule-id> ... --intent "<goal>" --file <each touched file>`.
7. Report the result. Do not commit or push — leave changes unstaged
   unless the user asks otherwise.

`catalyst <args>` is `python3 .criterion/bin/catalyst.pyz <args>`
(`CODE-OF-CONDUCT.md` §4).
