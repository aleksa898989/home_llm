import type {
  AdminState,
  AuthStatus,
  Chat,
  ChatChunk,
  ChatMessage,
  ChatSummary,
  ModelConfig,
  ModelsResponse,
  PublicUser,
  PullProgress,
  RegisterResponse,
} from "../../../shared/api.ts";
import { readNdjson, request, requestJson } from "./client.ts";

type Ok = { ok: true };

export const authApi = {
  status: () => requestJson<AuthStatus>("GET", "/api/auth/status"),
  me: () => requestJson<PublicUser>("GET", "/api/me"),
  login: (username: string, password: string) =>
    requestJson<PublicUser>("POST", "/api/auth/login", { username, password }),
  register: (username: string, password: string) =>
    requestJson<RegisterResponse>("POST", "/api/auth/register", { username, password }),
  logout: () => requestJson<Ok>("POST", "/api/auth/logout", {}),
  changePassword: (current: string, next: string) =>
    requestJson<Ok>("POST", "/api/auth/password", { current, next }),
};

export const chatApi = {
  models: () => requestJson<ModelsResponse>("GET", "/api/models"),
  list: () => requestJson<ChatSummary[]>("GET", "/api/chats"),
  get: (id: string) => requestJson<Chat>("GET", `/api/chats/${encodeURIComponent(id)}`),
  save: (chat: Pick<Chat, "id" | "title" | "model" | "messages">) =>
    requestJson<Ok>("PUT", `/api/chats/${encodeURIComponent(chat.id)}`, {
      title: chat.title,
      model: chat.model,
      messages: chat.messages,
    }),
  remove: (id: string) => requestJson<Ok>("DELETE", `/api/chats/${encodeURIComponent(id)}`),

  async *stream(model: string, messages: ChatMessage[], signal: AbortSignal) {
    const history = messages.map(({ role, content }) => ({ role, content }));
    const res = await request("POST", "/api/chat", { model, messages: history }, signal);
    yield* readNdjson<ChatChunk>(res);
  },
};

export const adminApi = {
  state: () => requestJson<AdminState>("GET", "/api/admin/state"),
  saveConfig: (config: ModelConfig) => requestJson<Ok>("PUT", "/api/admin/config", config),
  deleteModel: (name: string) => requestJson<Ok>("POST", "/api/admin/models/delete", { name }),
  async *pullModel(name: string, signal?: AbortSignal) {
    const res = await request("POST", "/api/admin/models/pull", { name }, signal);
    yield* readNdjson<PullProgress>(res);
  },
  updateUser: (id: number, changes: { approved?: boolean; isAdmin?: boolean }) =>
    requestJson<PublicUser>("PATCH", `/api/admin/users/${id}`, changes),
  resetPassword: (id: number) =>
    requestJson<{ password: string }>("POST", `/api/admin/users/${id}/reset-password`, {}),
  deleteUser: (id: number) => requestJson<Ok>("DELETE", `/api/admin/users/${id}`),
};
