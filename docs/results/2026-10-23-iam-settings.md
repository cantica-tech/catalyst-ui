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

## Then: catalyst-users becomes the facade, and the UI runs it (catalyst-users 0.3.0, UI 0.62.0)

The owner asked that catalyst-users be a command-line facade to any identity provider, Keycloak being one of them,
with other providers registered or built in. They chose: built-in provider modules plus Python entry points;
the provider's configuration in catalyst-users; the system account's secret held by catalyst-users. The account signs
in as a service account (client credentials): `catalyst-cli` refuses a password, and every catalyst client has the
password grant off.

| What                                                                                                                   | Where                                                                          |
| ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| catalyst-users [0.3.0](https://github.com/cantica-tech/catalyst-users/releases/tag/0.3.0) (its REQ-000006, REQ-000007) | `cantica-tech/catalyst-users` (PRs 7, 8); criterion PR 12                      |
| UI [0.62.0](https://github.com/cantica-tech/catalyst-ui/releases/tag/0.62.0) (REQ-000064)                              | `cantica-tech/catalyst-ui` (PRs 170, 171); criterion PR 88                     |
| The `.vsix` of 0.62.0                                                                                                  | `cantica-tech/cantica-tech`, `catalyst/vsix/v0.62.0/`                          |
| The decision, in the identity knowledge base                                                                           | `cantica-tech/catalyst-users-kb` (re-import of KSOURCE-000001); criterion PR 2 |

- **catalyst-users**: providers registered by name (built-in modules of `catalyst_users.providers`, or the entry-point
  group `catalyst_users.providers`, never replacing a built-in); the pointer from `--pointer`, `CATALYST_USERS_POINTER`
  or `config.toml`'s `provider` table; every CLI command through the provider; `providers`, `token --system`,
  `whoami --system`. The dev realm declares `catalyst-system`; `keycloak/set_system_client.py` creates it in a running
  realm and keeps its generated secret in the keychain.
- **UI**: `catalyst.iam.command` replaces every earlier IAM setting; **Check IAM Account** runs
  `<command> --json whoami --system`; **Set IAM Password** is gone, and a password it left in secret storage is deleted.
- **The owner's machine**: `~/.catalyst-users/config.toml` names the keycloak provider and its `secret_command`; the
  VS Code user settings hold `catalyst.iam.command` only; `catalyst-system` exists in the dev realm; 0.62.0 is installed.
- Checks: catalyst-users' unit tests (109) and, in CI, its integration suite against a fresh realm; locally the
  integration suite passed but for one test the owner's persistent realm fails (below). The UI's clean build (57
  tests). The built `iam.js` against the live stack answered `service-account-catalyst-system`. Every job of every pull
  request passed before its merge; the published `.vsix` holds `catalyst.iam.command` and the check command.

## Then: setup, and the admin as the system account (catalyst-users 0.4.0)

The owner specified setup: when `IAM/settings.json` is missing, ask for the provider type, its settings as JSON, the
admin's username, and their password or a command; check the provider; create its realm (from JSON holding no person)
and the admin if missing, else only sign the admin in. They decided: the file lives in `~/.catalyst-users/IAM/`; a
typed password goes to the keychain and the command reading it is stored; Keycloak's server admin is asked for, used
once; the admin replaces the `catalyst-system` service account as the local system account.

| What                                                                                                       | Where                                                      |
| ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| catalyst-users [0.4.0](https://github.com/cantica-tech/catalyst-users/releases/tag/0.4.0) (its REQ-000008) | `cantica-tech/catalyst-users` (PRs 9, 10); criterion PR 13 |
| The decision (§10.8), in the identity knowledge base                                                       | `cantica-tech/catalyst-users-kb`; criterion PR 3           |

- `catalyst-users setup` writes `IAM/settings.json` (`0600`): type, username, connection settings, password command;
  never a secret or the realm definition. A command without it asks for setup in a terminal.
- The admin signs in with the password grant on `catalyst-admin-cli`, a realm client with the groups, roles, grants
  and audience mappers; Keycloak's built-in `admin-cli` was tried and carries none of them.
- The realm file holds no person or secret; the integration tests create their people. Keycloak refused a created
  admin without an email and names, so setup asks for them when it creates one.
- The UI is unchanged: **Check IAM Account** still runs `whoami --system`, which now answers the admin.
- The owner's machine: `catalyst-admin-cli` added to the dev realm, `catalyst-system` removed from it and from the
  keychain, `config.toml` removed, setup run (the realm existed: signed in only). `whoami --system`, from the CLI and
  from the UI's code, answered the owner in `/catalyst-admins` with grants `cmd:*` and `reconcile:full`.
- Checks: 126 unit tests; in CI the integration suite against a fresh realm (setup creating a throwaway realm
  included); every job of every pull request passed before its merge.

## What's left

- **Run Catalyst: Check IAM Account in VS Code** (Reload Window first). REQ-000064 stays `Active` until it has been.
- **Nothing uses the account yet.** The first consumer (catalyst acting on the system's behalf with `systemToken`) is
  a later requirement.
- **The owner's dev realm's `developer` role holds extra grants** (`adopt`, `run-analysis`, `journal`) from an earlier
  provisioning, so `test_provisioned_grants_reach_the_token` fails locally (CI, on a fresh realm, passes). Reset the
  realm (`rm -rf .keycloack/data`, then `catalyst-users setup --force`, which recreates it with its admin) or accept
  the extra grants.
- **The identity knowledge base's build** is still 1.0.0; `/kb-build` would include §10.7 and §10.8.
- The Marketplace was not published to (it never is without asking).
