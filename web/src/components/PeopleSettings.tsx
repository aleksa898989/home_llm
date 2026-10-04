import type { PublicUser } from "../../../shared/api.ts";
import { adminApi } from "../api/endpoints.ts";

interface Props {
  users: PublicUser[];
  currentUserId: number;
  onChanged: () => void;
}

export function PeopleSettings({ users, currentUserId, onChanged }: Props) {
  const sorted = [...users].sort((a, b) => Number(a.approved) - Number(b.approved));

  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
    } catch (err) {
      alert((err as Error).message);
    }
    onChanged();
  };

  const resetPassword = (user: PublicUser) =>
    run(async () => {
      if (!confirm(`Reset ${user.username}'s password? They'll be signed out everywhere.`)) return;
      const { password } = await adminApi.resetPassword(user.id);
      prompt(`Temporary password for ${user.username} (they can change it under 👤):`, password);
    });

  const remove = (user: PublicUser) =>
    run(async () => {
      if (!confirm(`Delete ${user.username}'s account and all their chats?`)) return;
      await adminApi.deleteUser(user.id);
    });

  return (
    <section aria-labelledby="people-heading">
      <h3 id="people-heading">People</h3>
      <p className="muted small">
        People register on the sign-in page, then you approve them here.
      </p>

      {sorted.map((u) => (
        <div className="row" key={u.id} data-testid={`user-${u.username}`}>
          <span className="row-main">
            {u.username}
            {!u.approved && <span className="badge badge-warn">pending</span>}
            {u.approved && u.isAdmin && <span className="badge">admin</span>}
          </span>

          {u.id === currentUserId ? (
            <small className="muted">you</small>
          ) : (
            <>
              {u.approved ? (
                <button
                  className="btn btn-ghost"
                  onClick={() => run(() => adminApi.updateUser(u.id, { approved: false }))}
                >
                  Block
                </button>
              ) : (
                <button
                  className="btn btn-primary"
                  onClick={() => run(() => adminApi.updateUser(u.id, { approved: true }))}
                >
                  Approve
                </button>
              )}
              <button
                className="btn btn-ghost"
                onClick={() => run(() => adminApi.updateUser(u.id, { isAdmin: !u.isAdmin }))}
              >
                {u.isAdmin ? "Remove admin" : "Make admin"}
              </button>
              <button
                className="btn btn-ghost"
                aria-label={`Reset ${u.username}'s password`}
                onClick={() => resetPassword(u)}
              >
                🔑
              </button>
              <button
                className="btn btn-ghost btn-danger"
                aria-label={`Delete ${u.username}`}
                onClick={() => remove(u)}
              >
                ✕
              </button>
            </>
          )}
        </div>
      ))}
    </section>
  );
}
