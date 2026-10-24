# Results — 2026-10-24: the flask icon restored

The VS Code extension showed a "three dots" icon since 0.52.0. It was not an accident: REQ-000059 (19 October) replaced
the flask with a placeholder mark because the flask's licence was unknown. The owner confirmed the flask is theirs, so
it is back.

| What                                                                                      | Where                                                      |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| UI [0.64.0](https://github.com/cantica-tech/catalyst-ui/releases/tag/0.64.0) (REQ-000066) | `cantica-tech/catalyst-ui` (PRs 174, 175); criterion PR 94 |
| The `.vsix` of 0.64.0                                                                     | `cantica-tech/cantica-tech`, `catalyst/vsix/v0.64.0/`      |

- **The app icons** are the flask again: the Marketplace icon (`resources/icon.png`), the activity bar, views and
  `.catalyst` file icon (`resources/catalyst.svg`) and the desktop app icon (`build/icon.png`), restored from the
  commit before the placeholder. The shipped `icon.png` is byte-identical to 0.51.0's.
- **`brand/README.md`** records that the flask is the owner's (its licence known); the placeholder SVGs stay, unused.
- Checks: from a clean build, `task ci` (lint, format, typecheck, every package's tests); `catalyst check` passed;
  every job of both pull requests passed before its merge (the trace job re-run once, after the criterion PR merged).
  0.64.0 is installed in the owner's VS Code.

## What's left

- **The brand's own mark** (brand roadmap item 6) will replace the flask when it exists.
- **This deployment** (kernel 0.78.0) still signs with its registry; its move to catalyst-users is pending.
