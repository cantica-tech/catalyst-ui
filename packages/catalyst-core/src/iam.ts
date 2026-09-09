import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

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
 * `IAM/users/users.json` — `{"users": [...]}`, managed only by `/user-*`
 * commands. Never thrown from: a missing, empty, or malformed file
 * degrades to `[]` rather than killing the watch cycle, the same
 * graceful-degradation posture as every other parser here.
 */
export function parseIamUsers(corpusRoot: string): IamUser[] {
  const filePath = join(corpusRoot, "IAM", "users", "users.json");
  if (!existsSync(filePath)) return [];

  try {
    const parsed: unknown = JSON.parse(readFileSync(filePath, "utf8"));
    if (typeof parsed !== "object" || parsed === null) return [];
    const users = (parsed as Record<string, unknown>).users;
    if (!Array.isArray(users)) return [];
    return users
      .map(coerceUser)
      .filter((u): u is IamUser => u !== null)
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

/** `IAM/roles/roles.json` — `{"roles": [...]}`, managed only by `/role-*` commands. Same degrade-to-`[]` posture as `parseIamUsers`. */
export function parseIamRoles(corpusRoot: string): IamRole[] {
  const filePath = join(corpusRoot, "IAM", "roles", "roles.json");
  if (!existsSync(filePath)) return [];

  try {
    const parsed: unknown = JSON.parse(readFileSync(filePath, "utf8"));
    if (typeof parsed !== "object" || parsed === null) return [];
    const roles = (parsed as Record<string, unknown>).roles;
    if (!Array.isArray(roles)) return [];
    return roles
      .map(coerceRole)
      .filter((r): r is IamRole => r !== null)
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}
