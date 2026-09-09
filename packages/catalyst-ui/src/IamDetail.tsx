import type { IamRole, IamUser } from "catalyst-core";

export interface IamUserDetailProps {
  user: IamUser;
  roles: IamRole[];
}

export interface IamRoleDetailProps {
  role: IamRole;
  users: IamUser[];
}

function RoleList({ roles }: { roles: IamRole[] }) {
  return (
    <section>
      <h2>Roles</h2>
      {roles.length === 0 ? (
        <p>None.</p>
      ) : (
        <ul>
          {roles.map((r) => (
            <li key={r.name}>{r.name}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

function UserList({ users }: { users: IamUser[] }) {
  return (
    <section>
      <h2>Users</h2>
      {users.length === 0 ? (
        <p>None.</p>
      ) : (
        <ul>
          {users.map((u) => (
            <li key={u.name}>
              {u.name}
              {u.active ? "" : " (inactive)"}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** A registered user's detail view: itself plus the role objects its `roles` array names, cross-referenced by name (IAM has no ID-shaped scheme). */
export function IamUserDetail({ user, roles }: IamUserDetailProps) {
  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.active ? "active" : "inactive"}</p>
      <p>Registered: {user.registered}</p>
      {user.notes ? <p>{user.notes}</p> : null}
      <RoleList roles={roles} />
    </div>
  );
}

/** A registered role's detail view: itself plus every user whose `roles` array names it. */
export function IamRoleDetail({ role, users }: IamRoleDetailProps) {
  return (
    <div>
      <h1>{role.name}</h1>
      <section>
        <h2>Actions</h2>
        {role.actions.length === 0 ? (
          <p>None.</p>
        ) : (
          <ul>
            {role.actions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        )}
      </section>
      <UserList users={users} />
    </div>
  );
}
