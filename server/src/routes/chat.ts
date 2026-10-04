import { HttpError } from "../errors.ts";
import { readJson } from "../http/request.ts";
import { proxyStream, sendJson } from "../http/response.ts";
import type { Router } from "../http/router.ts";
import { availableModels } from "../models.ts";
import { ChatOwnershipError } from "../repos/chats.ts";
import { parse, schemas } from "../validation.ts";
import type { RouteDeps } from "./deps.ts";

export function registerChatRoutes(router: Router, deps: RouteDeps) {
  const { ollama, settings, chats, log } = deps;

  router.add("user", "GET /api/models", async ({ res }) =>
    sendJson(res, 200, await availableModels(ollama, settings)),
  );

  router.add("user", "POST /api/chat", async ({ req, res, user }) => {
    const { model, messages, think } = parse(schemas.chatRequest, await readJson(req));
    const { models } = await availableModels(ollama, settings);
    if (!models.some((m) => m.name === model)) throw new HttpError(400, "Model not available");

    log(`chat ${user.username} -> ${model}`);
    await proxyStream(res, (signal) =>
      ollama.chat(
        { model, think, messages: messages.map(({ role, content }) => ({ role, content })) },
        signal,
      ),
    );
  });

  router.add("user", "GET /api/chats", ({ res, user }) => sendJson(res, 200, chats.list(user.id)));

  router.add("user", "GET /api/chats/:id", ({ res, user, params }) => {
    const chat = chats.get(user.id, parse(schemas.chatId, params.id));
    if (!chat) throw new HttpError(404, "Chat not found");
    sendJson(res, 200, chat);
  });

  router.add("user", "PUT /api/chats/:id", async ({ req, res, user, params }) => {
    const id = parse(schemas.chatId, params.id);
    const { title, model, messages } = parse(schemas.saveChat, await readJson(req));
    try {
      chats.save(user.id, { id, title, model: model ?? null, messages });
    } catch (e) {
      if (e instanceof ChatOwnershipError) throw new HttpError(404, "Chat not found");
      throw e;
    }
    sendJson(res, 200, { ok: true });
  });

  router.add("user", "DELETE /api/chats/:id", ({ res, user, params }) => {
    chats.remove(user.id, parse(schemas.chatId, params.id));
    sendJson(res, 200, { ok: true });
  });
}
