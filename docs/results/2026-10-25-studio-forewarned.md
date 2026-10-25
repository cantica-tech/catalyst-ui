# Results — 2026-10-25: an admin's write in the Studio is tried before it is permanent (UI 0.65.0)

| What                                                                                      | Where                                                       |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| UI [0.65.0](https://github.com/cantica-tech/catalyst-ui/releases/tag/0.65.0) (REQ-000067) | `cantica-tech/catalyst-ui` (PRs 180, 181); criterion PR 107 |
| The `.vsix` of 0.65.0                                                                     | `cantica-tech/cantica-tech`, `catalyst/vsix/v0.65.0/`       |
| Design 26, editing in the Studio (decided)                                                | `docs/design/26-studio-editing.md`                          |

- **The forewarning** (`studio-SHELL-000029`): with catalyst 0.112.0 or later, submitting an action the Studio can try
  tries it first and shows what it would change; **Make it permanent**, or **Make it permanent anyway** when it adds
  findings, runs it with `--forewarned`, so catalyst records what it added in the journal; **Cancel** keeps nothing.
  The Studio signs as the machine's system account, an admin, so every write it offers is an admin's. An older
  kernel runs actions as before.
- **spec/ and the desktop app** at catalyst 0.112.0.
- Checks: from a clean build, `task ci` (lint, format, typecheck, every package's tests); every job of both pull
  requests passed before its merge. 0.65.0 is installed in the owner's VS Code; the forewarning has not yet been tried
  there by a person.

## What's left

- **Design 26's editor**: the form made from each type's definition, **New…**, **Retire**, **Request change**, once
  catalyst's design 31 brings its later phases (contributors' types, workflows for edits, tags).
- **Trying the forewarning in VS Code** on a real deployment.
