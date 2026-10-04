import type { PublicUser } from "../../../shared/api.ts";
import type { Database } from "../db.ts";

export type User = PublicUser;

interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  is_admin: number;
  approved: number;
  created_at: number;
}

const toUser = (row: UserRow): User => ({
  id: row.id,
  username: row.username,
  isAdmin: row.is_admin === 1,
  approved: row.approved === 1,
  createdAt: row.created_at,
});

export class UsernameTakenError extends Error {
  constructor() {
    super("Username is taken");
  }
}

const SQLITE_CONSTRAINT_UNIQUE = 2067;

export function createUsersRepo(db: Database) {
  const byId = db.prepare("SELECT * FROM users WHERE id = ?");
  const byName = db.prepare("SELECT * FROM users WHERE username = ?");

  return {
    count: () => (db.prepare("SELECT count(*) AS n FROM users").get() as { n: number }).n,

    list: () =>
      (db.prepare("SELECT * FROM users ORDER BY created_at, id").all() as unknown as UserRow[]).map(
        toUser,
      ),

    findById(id: number): User | undefined {
      const row = byId.get(id) as UserRow | undefined;
      return row && toUser(row);
    },

    findCredentials(username: string) {
      const row = byName.get(username) as UserRow | undefined;
      return row && { user: toUser(row), passwordHash: row.password_hash };
    },

    create(username: string, passwordHash: string, { admin = false, approved = false } = {}): User {
      try {
        const { lastInsertRowid } = db
          .prepare(
            "INSERT INTO users (username, password_hash, is_admin, approved) VALUES (?, ?, ?, ?)",
          )
          .run(username, passwordHash, Number(admin), Number(approved));
        return toUser(byId.get(lastInsertRowid) as unknown as UserRow);
      } catch (e) {
        if ((e as { errcode?: number }).errcode === SQLITE_CONSTRAINT_UNIQUE)
          throw new UsernameTakenError();
        throw e;
      }
    },

    update(id: number, changes: { approved?: boolean; isAdmin?: boolean; passwordHash?: string }) {
      const columns = {
        approved: changes.approved === undefined ? undefined : Number(changes.approved),
        is_admin: changes.isAdmin === undefined ? undefined : Number(changes.isAdmin),
        password_hash: changes.passwordHash,
      };
      const entries = Object.entries(columns).filter(([, v]) => v !== undefined);
      if (!entries.length) return;
      const assignments = entries.map(([column]) => `${column} = ?`).join(", ");
      db.prepare(`UPDATE users SET ${assignments} WHERE id = ?`).run(
        ...entries.map(([, v]) => v as string | number),
        id,
      );
    },

    remove: (id: number) => void db.prepare("DELETE FROM users WHERE id = ?").run(id),
  };
}

export type UsersRepo = ReturnType<typeof createUsersRepo>;
