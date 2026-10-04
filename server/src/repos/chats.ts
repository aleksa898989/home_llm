import type { Chat, ChatMessage, ChatSummary } from "../../../shared/api.ts";
import type { Database } from "../db.ts";

interface ChatRow {
  id: string;
  user_id: number;
  title: string;
  model: string | null;
  messages: string;
  updated_at: number;
}

export class ChatOwnershipError extends Error {
  constructor() {
    super("Chat belongs to another user");
  }
}

export function createChatsRepo(db: Database) {
  const list = db.prepare(
    "SELECT id, title, model, updated_at AS updatedAt FROM chats WHERE user_id = ? ORDER BY updated_at DESC, rowid DESC",
  );
  const get = db.prepare("SELECT * FROM chats WHERE id = ?");
  const upsert = db.prepare(`
    INSERT INTO chats (id, user_id, title, model, messages, updated_at)
    VALUES (?, ?, ?, ?, ?, unixepoch())
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title, model = excluded.model,
      messages = excluded.messages, updated_at = excluded.updated_at
  `);
  const remove = db.prepare("DELETE FROM chats WHERE id = ? AND user_id = ?");

  return {
    list: (userId: number) => list.all(userId) as unknown as ChatSummary[],

    get(userId: number, id: string): Chat | undefined {
      const row = get.get(id) as ChatRow | undefined;
      if (!row || row.user_id !== userId) return undefined;
      return {
        id: row.id,
        title: row.title,
        model: row.model,
        messages: JSON.parse(row.messages) as ChatMessage[],
        updatedAt: row.updated_at,
      };
    },

    save(userId: number, chat: Omit<Chat, "updatedAt">) {
      const existing = get.get(chat.id) as ChatRow | undefined;
      if (existing && existing.user_id !== userId) throw new ChatOwnershipError();
      upsert.run(chat.id, userId, chat.title, chat.model, JSON.stringify(chat.messages));
    },

    remove: (userId: number, id: string) => void remove.run(id, userId),
  };
}

export type ChatsRepo = ReturnType<typeof createChatsRepo>;
