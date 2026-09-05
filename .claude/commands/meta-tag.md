---
description: Attach a lightweight comment/version/link-to annotation to an existing artifact
argument-hint: <artifact-id> --key comment|version|link-to --value <value>
---

Create a new meta-tag artifact. Full spec:
`.criterion/CODE-OF-CONDUCT.md` §3/§4, template:
`.criterion/development/meta-tags/templates/TEMPLATE-META-TAG-v1.md`.
Input: $ARGUMENTS

1. If the key isn't supplied explicitly, prompt for it — one of
   `comment`, `version`, `link-to`.
2. Save as `meta-tags/tag-<key>-<artefact-id>.md`.
3. Register it in `meta-tags/meta-tags.md`, linked to the target artifact.
4. Report the result. Do not commit or push — leave changes unstaged
   unless the user asks otherwise.
