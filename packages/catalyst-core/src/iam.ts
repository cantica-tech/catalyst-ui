import type { IamRole, IamUser } from "./types.js";

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

function coerceUser(value: unknown): IamUser | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.name !== "string") return null;
  return {
    name: record.name,
    roles: isStringArray(record.roles) ? record.roles : [],
    registered: typeof record.registered === "string" ? record.registered : "",
    active: record.active === true,
    notes: typeof record.notes === "string" ? record.notes : "",
  };
}

function coerceRole(value: unknown): IamRole | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.name !== "string") return null;
  return {
    name: record.name,
    actions: isStringArray(record.actions) ? record.actions : [],
  };
}

/**
 * The registered users as catalyst lists them (`GET /v1/list?type=users`,
 * R5.3: never read from the criterion's files here). Anything but a list of
 * users degrades to `[]`, so a watch cycle never dies of it.
 */
export function usersFrom(list: unknown): IamUser[] {
  if (!Array.isArray(list)) return [];
  return list
    .map(coerceUser)
    .filter((u): u is IamUser => u !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The roles as catalyst lists them (`GET /v1/list?type=role`); the same degrade-to-`[]` posture. */
export function rolesFrom(list: unknown): IamRole[] {
  if (!Array.isArray(list)) return [];
  return list
    .map(coerceRole)
    .filter((r): r is IamRole => r !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}
