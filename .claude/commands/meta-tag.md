---
description: Attach a lightweight comment/version/link-to annotation to an existing artifact
argument-hint: <artifact-id> --key comment|version|link-to --value <value>
---

Create a new meta-tag artifact. Full spec:
`.criterion/CODE-OF-CONDUCT.md` §3/§4, template: the highest-versioned
`.criterion/development/meta-tags/templates/TEMPLATE-META-TAG-vN.md`.
Input: $ARGUMENTS

1. If the key isn't supplied explicitly, prompt for it — one of
   `comment`, `version`, `link-to`.
2. Save as `meta-tags/tag-<key>-<artefact-id>.md` (named, not numbered:
   no ID to allocate).
3. Register it in `meta-tags/meta-tags.md`, linked to the target artifact
   (a hand-added row: this is not an entity index `catalyst index regen`
   builds).
4. Journal it: `catalyst journal append --command /meta-tag --action create
   --artifact tag-<key>-<artefact-id> --intent "<goal>" --file <tag file>
   --file <meta-tags.md>`.
5. Report the result. Do not commit or push — leave changes unstaged
   unless the user asks otherwise.

`catalyst <args>` is `python3 .criterion/bin/catalyst.pyz <args>`
(`CODE-OF-CONDUCT.md` §4).
