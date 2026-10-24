# Results — 2026-10-24: catalyst-ui's deployment on Keycloak

catalyst-ui's own deployment moved from kernel 0.78.0 to 0.106.1: its people are now catalyst-users' (the local
Keycloak), like catalyst's, catalyst-users' and the knowledge base's.

| What                             | Where                                             |
| -------------------------------- | ------------------------------------------------- |
| The deployment at kernel 0.106.1 | `cantica-tech/catalyst-ui-criterion` (PRs 97, 98) |
| `catalyst.toml` at 0.106.1       | `cantica-tech/catalyst-ui`, `development`         |

- **Identity**: `catalyst identity configure --issuer http://localhost:8080/realms/catalyst --link "Olivier Steck"`;
  the owner keeps userid `UVqkd7cL`. `catalyst identity whoami` answers `oliviersteck`, roles `Admin` and
  `knowledge-curator`.
- **Sync and migration** (0.81.0 to 0.106.0): `users.json` and `roles.json` retired; the 8 roles kept as
  TEMPLATE-ROLES-v3 under the kernel's ids (`Admin` is `catalyst-admin`); the groups templates and the kernel
  templates' new versions added; the `user` and `role` definitions at v2. The only user is an `Admin`, so no role
  gained commands; the kernel roles were already in the provider.
- **Published in two steps** (BUG-000011): the shared criterion's gate ran the 0.78.0 checker, which requires the
  registries; step 1 kept them, step 2 retired them. Both gates passed before their merges.
- Checks: `catalyst check` passes (0 errors).

## What's left

- **The software-engineering module** stays at 3.2.0; a module upgrade is its own step.
- **Every signed catalyst command here** needs the local Keycloak up (`docker compose up -d` in catalyst-users).
