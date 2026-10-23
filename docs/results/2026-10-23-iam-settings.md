# Results — 2026-10-23: the IAM settings

The owner asked for an **IAM** setting in the UI naming the account catalyst uses locally, on the system's behalf:
a type (a list holding only `keycloak`, selected), a URL (`http://localhost:8080/`), a user name, and a password that
is either entered masked or printed by a command (here catalyst-users' `.keycloack/scripts/get-keycloack-accnt.sh pwd`).

| What                                                                                      | Where                                                                             |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| UI [0.60.0](https://github.com/cantica-tech/catalyst-ui/releases/tag/0.60.0) (REQ-000062) | `cantica-tech/catalyst-ui`                                                        |
| The `.vsix` of 0.60.0                                                                     | the distribution repository `cantica-tech/cantica-tech`, `catalyst/vsix/v0.60.0/` |
| The `IAM` domain, rule `vscode-IAM-000001`, REQ-000062, STEP-000078                       | `cantica-tech/catalyst-ui-criterion` (PR 84)                                      |

## What the VS Code extension does now

- **An IAM settings section** beside _Catalyst_: `catalyst.iam.type`, `catalyst.iam.url`, `catalyst.iam.username`,
  `catalyst.iam.password.source` (`secret` or `command`) and `catalyst.iam.password.command`.
- **A masked password, never in a settings file.** The Settings editor cannot mask a value, so
  **Catalyst: Set IAM Password…** asks for it in a password box and keeps it in VS Code's secret storage; an empty
  answer clears it.
- **A password command**, run only when the account is asked for, without a shell (words split, quotes kept
  together, a leading `~/` expanded); its first line is the password, never stored. A failing or silent command
  yields no password and says why.
- **Catalyst: Check IAM Account** reports the type, URL, user name and whether a password came back, never the
  password.

## Checks

- From a clean build: lint, format check, typecheck, the tests (58 in the VS Code host, seven of them new) and the
  Studio build passed.
- The development → main and main → release pull requests (166, 167) merged after every job passed. `catalyst-trace`
  first failed on 166 because the criterion's PR 84 was not merged yet; it passed once PR 84 was.
- The published `.vsix` was opened: version 0.60.0, the _IAM_ section and its five settings.

## Then: the settings point to catalyst-users (UI 0.61.0)

The owner asked that the UI point to catalyst-users instead of Keycloak's URL, and chose catalyst-users' pointer
document (over running the `catalyst-users` command) and to keep the user name and password.

| What                                                                                      | Where                                                 |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| UI [0.61.0](https://github.com/cantica-tech/catalyst-ui/releases/tag/0.61.0) (REQ-000063) | `cantica-tech/catalyst-ui` (PRs 168, 169)             |
| The `.vsix` of 0.61.0                                                                     | `cantica-tech/cantica-tech`, `catalyst/vsix/v0.61.0/` |
| `vscode-IAM-000001` amended, REQ-000063, STEP-000079                                      | `cantica-tech/catalyst-ui-criterion` (PR 86)          |

- `catalyst.iam.provider` (only `keycloak`), `catalyst.iam.issuer` (`http://localhost:8080/realms/catalyst`) and
  `catalyst.iam.client` (`catalyst-cli`) replace `catalyst.iam.type` and `catalyst.iam.url`: together the pointer
  catalyst-users reads, `{"provider", "issuer", "client"}`, the shape a deployment's `identity = "oidc"` names.
- A blank issuer is reported as catalyst-users reports it; **Check IAM Account** reports the pointer and every problem.
- Checks: a clean build's lint, format check, typecheck, tests (59, eight IAM) and Studio build; every job of both
  pull requests and of the criterion's PR 86 passed before its merge; the published `.vsix` holds the six settings.

## What's left

- **Not yet seen in an installed extension.** REQ-000062 and REQ-000063 stay `Active` until the IAM section and both
  commands are tried in VS Code (`task install:vscode-extension`), then `Completed`.
- **0.60.0's `catalyst.iam.type` and `catalyst.iam.url` are not migrated**: a machine that set them sets the pointer
  instead (the owner's settings were moved).
- **Nothing uses the account yet.** It is configured and resolvable; the first consumer (signing in through catalyst-users on
  catalyst's behalf) is a later requirement.
- The Marketplace was not published to (it never is without asking).
