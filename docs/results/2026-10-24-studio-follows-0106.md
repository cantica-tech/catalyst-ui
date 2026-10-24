# Results — 2026-10-24: the Studio follows catalyst 0.106.0

catalyst 0.106.0 (design 29) moved people, roles and grants out of the criterion into catalyst-users: `catalyst user`
and `catalyst role` refuse. The UI followed.

| What                                                                                      | Where                                                      |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| UI [0.63.0](https://github.com/cantica-tech/catalyst-ui/releases/tag/0.63.0) (REQ-000065) | `cantica-tech/catalyst-ui` (PRs 172, 173); criterion PR 92 |
| The `.vsix` of 0.63.0                                                                     | `cantica-tech/cantica-tech`, `catalyst/vsix/v0.63.0/`      |

- **The Team view** of a deployment at kernel 0.106.0 or later offers no registration, role or deactivation form, and
  says people, roles and grants are managed in catalyst-users; an older deployment keeps its forms
  (`studio-SHELL-000012` amended). It reads the kernel from `GET /v1/head`.
- **`spec/`** is catalyst 0.106.0's: the `identity-whoami` and `identity-status` schemas added, `user`, `role` and
  `approve` as catalyst 0.105 left them; the types regenerated.
- **The desktop app** ships kernel 0.106.0.
- Checks: from a clean build, lint, format, typecheck, every package's tests and the Studio build; every job of both
  pull requests passed before its merge. 0.63.0 is installed in the owner's VS Code.

## What's left

- **This deployment** (catalyst-ui's own criterion, kernel 0.78.0) still signs with its registry: moving it to
  catalyst-users is the 0.106.0 migration, a step with the owner (it needs the local Keycloak, as catalyst's does).
- **The VS Code extension's IAM setting** (`catalyst.iam.command`, Check IAM Account) is unchanged and still answers
  the system account through catalyst-users.
- **Run Check IAM Account** once in VS Code (REQ-000064 stays `Active` until then).
