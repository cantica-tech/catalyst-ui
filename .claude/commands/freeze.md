---
description: Protect an item from /sync-framework by recording its path in the root .frozen file
argument-hint: <item-id|item-path|type|template-name>
---

Freeze an item against synchronization. Sources:
`.criterion/CODE-OF-CONDUCT.md` §4.
First run `catalyst spec freeze` and follow it: it prints this command's
part of `CODE-OF-CONDUCT.md` §4, the canonical text. Open the sources
above in full only when the spec points elsewhere or a judgment needs
the Rules-of-Rules sections they cite.
Input: $ARGUMENTS

1. Resolve the argument to a backing file path — accepts an item ID, an
   item path, a type, or a template name.
2. Append that path to the root-level `.frozen` file if not already
   present.
3. Report success. The item stays protected from `/sync-framework` until
   explicitly removed from `.frozen` or re-synced with an override.
