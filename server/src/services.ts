import type { Database } from "./db.ts";
import { createSessionStore } from "./auth/sessions.ts";
import { createChatsRepo } from "./repos/chats.ts";
import { createSettingsRepo } from "./repos/settings.ts";
import { createUsersRepo } from "./repos/users.ts";

export function createServices(db: Database) {
  return {
    users: createUsersRepo(db),
    chats: createChatsRepo(db),
    settings: createSettingsRepo(db),
    sessions: createSessionStore(db),
  };
}

export type Services = ReturnType<typeof createServices>;
