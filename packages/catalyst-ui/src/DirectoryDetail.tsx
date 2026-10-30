import type { DirectoryGroup, DirectoryKind, DirectoryRole, DirectoryUser, Holding } from "catalyst-core";

/**
 * The Users panel's documents (vscode-IAM-000003-UVqkd7cL): a user's, a
 * role's and a group's, read through catalyst-users. Every user, role and
 * group they name is a link (`data-directory-kind`, `data-directory-name`)
 * the host opens in its own document; presentational only.
 */

export const DIRECTORY_LINK_CLASS = "catalyst-directory-link";

/** The user, role or group a click landed on, if it was a directory link. */
export function directoryTarget(target: EventTarget | null): { kind: DirectoryKind; name: string } | null {
  const el = target instanceof Element ? target.closest(`a.${DIRECTORY_LINK_CLASS}`) : null;
  const kind = el?.getAttribute("data-directory-kind");
  const name = el?.getAttribute("data-directory-name");
  if (!name || (kind !== "user" && kind !== "role" && kind !== "group")) return null;
  return { kind, name };
}

function Link({ kind, name }: { kind: DirectoryKind; name: string }) {
  return (
    <a href="#" className={DIRECTORY_LINK_CLASS} data-directory-kind={kind} data-directory-name={name}>
      {name}
    </a>
  );
}

/** How a role is held: directly, through groups (each a link), or both. */
function How({ holding }: { holding: Holding }) {
  const parts = [
    ...(holding.direct ? [<span key="direct">directly</span>] : []),
    ...holding.groups.map((g) => (
      <span key={g}>
        through <Link kind="group" name={g} />
      </span>
    )),
  ];
  return (
    <span>
      {" — "}
      {parts.map((part, i) => (
        <span key={i}>
          {i > 0 ? ", " : ""}
          {part}
        </span>
      ))}
    </span>
  );
}

function Names({ title, kind, names }: { title: string; kind: DirectoryKind; names: string[] }) {
  return (
    <section>
      <h2>{title}</h2>
      {names.length === 0 ? (
        <p>None.</p>
      ) : (
        <ul>
          {names.map((n) => (
            <li key={n}>
              <Link kind={kind} name={n} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export interface DirectoryUserDetailProps {
  user: DirectoryUser;
  roles: ({ name: string } & Holding)[];
  groups: string[];
}

export function DirectoryUserDetail({ user, roles, groups }: DirectoryUserDetailProps) {
  return (
    <div>
      <h1>{user.username}</h1>
      <p>
        {user.name || user.username}
        {user.email ? ` · ${user.email}` : ""} · {user.enabled ? "enabled" : "disabled"}
      </p>
      <section>
        <h2>Roles</h2>
        {roles.length === 0 ? (
          <p>None.</p>
        ) : (
          <ul>
            {roles.map((r) => (
              <li key={r.name}>
                <Link kind="role" name={r.name} />
                <How holding={r} />
              </li>
            ))}
          </ul>
        )}
      </section>
      <Names title="Groups" kind="group" names={groups} />
    </div>
  );
}

export interface DirectoryRoleDetailProps {
  role: DirectoryRole;
  groups: string[];
  users: ({ username: string } & Holding)[];
}

export function DirectoryRoleDetail({ role, groups, users }: DirectoryRoleDetailProps) {
  return (
    <div>
      <h1>{role.name}</h1>
      {role.description ? <p>{role.description}</p> : null}
      <section>
        <h2>Held by</h2>
        {users.length === 0 ? (
          <p>No one.</p>
        ) : (
          <ul>
            {users.map((u) => (
              <li key={u.username}>
                <Link kind="user" name={u.username} />
                <How holding={u} />
              </li>
            ))}
          </ul>
        )}
      </section>
      <Names title="Granted to groups" kind="group" names={groups} />
    </div>
  );
}

export interface DirectoryGroupDetailProps {
  group: DirectoryGroup;
  members: string[];
}

export function DirectoryGroupDetail({ group, members }: DirectoryGroupDetailProps) {
  return (
    <div>
      <h1>{group.path}</h1>
      <Names title="Roles" kind="role" names={group.roles} />
      <Names title="Members" kind="user" names={members} />
    </div>
  );
}
