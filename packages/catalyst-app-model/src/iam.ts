import type { IamRole, IamUser } from "catalyst-core";

export interface UserSection {
  label: string;
  users: IamUser[];
}

export interface RoleSection {
  label: string;
  roles: IamRole[];
}

/** A 9th sidebar section listing every registered user, alongside roadmaps/proposals/runs and the five chain-model sections. */
export function buildUserSection(users: IamUser[]): UserSection {
  return { label: `Users (${users.length})`, users };
}

/** A 10th sidebar section listing every registered role. */
export function buildRoleSection(roles: IamRole[]): RoleSection {
  return { label: `Roles (${roles.length})`, roles };
}
