---
description: Update a deployed entity definition to a specific version, only if that version exists
argument-hint: <entity-type> <version>
---

Move a deployed entity definition forward. Full spec:
`.criterion/CODE-OF-CONDUCT.md` §4.
Input: $ARGUMENTS

1. Confirm `<entity-type>` names a real entity type (this framework's
   source has a `definitions/<entity-type>/` folder for it). Refuse and
   name the valid types if not.
2. Obtain this framework's current source content the same way
   `/sync-framework` does, and check whether
   `definitions/<entity-type>/DEFINITION-<ENTITY-TYPE>-v<version>.md`
   exists there. Refuse and report the highest version that does exist if
   it doesn't — never guess or round to the nearest one.
3. Overwrite `.criterion/definitions/<entity-type>.md` with that exact
   version's content — the only way that file ever changes once deployed.
4. Report the old version moving to the new one. Do not commit or push —
   leave changes unstaged unless the user asks otherwise.
