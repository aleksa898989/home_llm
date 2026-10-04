import crypto from "node:crypto";
import type { Database } from "../db.ts";

export const SESSION_TTL_SECONDS = 30 * 86_400;

const sha256 = (value: string) => crypto.createHash("sha256").update(value).digest("hex");

export function createSessionStore(db: Database) {
  const insert = db.prepare(
    "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, unixepoch() + ?)",
  );
  const lookup = db.prepare(
    "SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > unixepoch()",
  );
  const remove = db.prepare("DELETE FROM sessions WHERE token_hash = ?");
  const removeForUser = db.prepare("DELETE FROM sessions WHERE user_id = ?");
  const removeExpired = db.prepare("DELETE FROM sessions WHERE expires_at <= unixepoch()");

  return {
    create(userId: number): string {
      const token = crypto.randomBytes(32).toString("base64url");
      insert.run(sha256(token), userId, SESSION_TTL_SECONDS);
      return token;
    },
    userId(token: string): number | undefined {
      const row = lookup.get(sha256(token)) as { user_id: number } | undefined;
      return row?.user_id;
    },
    destroy: (token: string) => void remove.run(sha256(token)),
    destroyAllFor: (userId: number) => void removeForUser.run(userId),
    purgeExpired: () => void removeExpired.run(),
  };
}

export type SessionStore = ReturnType<typeof createSessionStore>;
