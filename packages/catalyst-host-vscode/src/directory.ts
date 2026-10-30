/**
 * The Users panel's reads (`vscode-IAM-000003-UVqkd7cL`): the identity
 * provider's users, realm roles and groups, and who holds what, all through
 * catalyst-users (`catalyst.iam.command`) with the logged-in person's own
 * rights. Nothing here changes the directory. Pure but for running the
 * command, so it is unit-tested without a VS Code host.
 */

import type { DirectoryGroup, DirectoryRole, DirectoryUser, Holding, WebviewPayload } from "catalyst-core";

import { type Answer, catalystUsers, type IamSettings, type RunCommand, runCommand } from "./iam.js";

export interface Directory {
  users: DirectoryUser[];
  roles: DirectoryRole[];
  groups: DirectoryGroup[];
}

type Record_ = Record<string, unknown>;

const text = (value: unknown): string => (typeof value === "string" ? value : "");
const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
const records = (value: unknown): Record_[] =>
  Array.isArray(value) ? value.filter((v): v is Record_ => typeof v === "object" && v !== null) : [];

function user(rep: Record_): DirectoryUser {
  return {
    username: text(rep.username),
    name: text(rep.name),
    email: typeof rep.email === "string" ? rep.email : null,
    enabled: rep.enabled !== false,
  };
}

function holding(rep: Record_): Holding {
  return { direct: rep.direct === true, groups: strings(rep.groups) };
}

const byName =
  <T>(key: (t: T) => string) =>
  (a: T, b: T) =>
    key(a).localeCompare(key(b));

/** Every user, realm role and group: `users list`, `roles list`, `groups list`. */
export async function readDirectory(settings: IamSettings, run: RunCommand = runCommand): Promise<Answer<Directory>> {
  const [users, roles, groups] = await Promise.all([
    catalystUsers(settings, ["users", "list"], run),
    catalystUsers(settings, ["roles", "list"], run),
    catalystUsers(settings, ["groups", "list"], run),
  ]);
  for (const answer of [users, roles, groups]) if (answer.problem !== undefined) return { problem: answer.problem };
  return {
    value: {
      users: records(users.value)
        .map(user)
        .filter((u) => u.username)
        .sort(byName((u) => u.username)),
      roles: records(roles.value)
        .map((r) => ({ name: text(r.name), description: text(r.description) }))
        .filter((r) => r.name)
        .sort(byName((r) => r.name)),
      groups: records(groups.value)
        .map((g) => ({ path: text(g.path), roles: strings(g.roles).sort() }))
        .filter((g) => g.path)
        .sort(byName((g) => g.path)),
    },
  };
}

/** A user's document: the roles they hold, each with how (`users roles`), and their groups (`users groups`). */
export async function userDocument(
  settings: IamSettings,
  found: DirectoryUser,
  run: RunCommand = runCommand,
): Promise<Answer<WebviewPayload>> {
  const [roles, groups] = await Promise.all([
    catalystUsers(settings, ["users", "roles", found.username], run),
    catalystUsers(settings, ["users", "groups", found.username], run),
  ]);
  if (roles.problem !== undefined) return { problem: roles.problem };
  if (groups.problem !== undefined) return { problem: groups.problem };
  return {
    value: {
      type: "directory-user",
      user: found,
      roles: records(roles.value)
        .map((r) => ({ name: text(r.name), ...holding(r) }))
        .filter((r) => r.name),
      groups: strings(groups.value).sort(),
    },
  };
}

/** A role's document: the groups granted it and who holds it, each with how (`roles holders`). */
export async function roleDocument(
  settings: IamSettings,
  role: DirectoryRole,
  run: RunCommand = runCommand,
): Promise<Answer<WebviewPayload>> {
  const answer = await catalystUsers(settings, ["roles", "holders", role.name], run);
  if (answer.problem !== undefined) return answer;
  const data = (answer.value ?? {}) as Record_;
  return {
    value: {
      type: "directory-role",
      role,
      groups: strings(data.groups).sort(),
      users: records(data.users)
        .map((u) => ({ username: text(u.username), ...holding(u) }))
        .filter((u) => u.username),
    },
  };
}

/** A group's document: its roles (from the list) and its direct members (`groups members`). */
export async function groupDocument(
  settings: IamSettings,
  group: DirectoryGroup,
  run: RunCommand = runCommand,
): Promise<Answer<WebviewPayload>> {
  const answer = await catalystUsers(settings, ["groups", "members", group.path], run);
  if (answer.problem !== undefined) return answer;
  return { value: { type: "directory-group", group, members: strings(answer.value).sort() } };
}
