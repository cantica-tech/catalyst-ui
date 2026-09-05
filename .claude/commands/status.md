---
description: Update an artifact or work item's Status field
argument-hint: <artefact-id> <status> [force]
---

Update an artifact's `Status` field. Full spec:
`.criterion/CODE-OF-CONDUCT.md` §4.
Input: $ARGUMENTS

1. If the artifact ID doesn't resolve, say it cannot be found.
2. If the supplied status is valid for that artifact type, change it
   normally.
3. If invalid and `force` is supplied, change it to that value anyway.
4. If invalid and `force` is not supplied, refuse and do not modify the
   artifact.
5. Report the result.
