import { hashPassword, randomPassword } from "../auth/password.ts";
import { HttpError } from "../errors.ts";
import { readJson } from "../http/request.ts";
import { proxyStream, sendJson } from "../http/response.ts";
import type { Router } from "../http/router.ts";
import { parse, schemas } from "../validation.ts";
import type { RouteDeps } from "./deps.ts";

export function registerAdminRoutes(router: Router, deps: RouteDeps) {
  const { ollama, settings, users, sessions, log } = deps;

  const targetUser = (actorId: number, rawId: string | undefined) => {
    const id = parse(schemas.userId, rawId);
    if (id === actorId) throw new HttpError(400, "You can't change your own account here");
    const user = users.findById(id);
    if (!user) throw new HttpError(404, "User not found");
    return user;
  };

  router.add("admin", "GET /api/admin/state", async ({ res }) =>
    sendJson(res, 200, {
      installed: await ollama.listModels(),
      config: settings.modelConfig(),
      users: users.list(),
    }),
  );

  router.add("admin", "PUT /api/admin/config", async ({ req, res }) => {
    settings.saveModelConfig(parse(schemas.modelConfig, await readJson(req)));
    sendJson(res, 200, { ok: true });
  });

  router.add("admin", "POST /api/admin/models/pull", async ({ req, res, user }) => {
    const { name } = parse(schemas.modelName, await readJson(req));
    log(`${user.username} pulling ${name}`);
    await proxyStream(res, (signal) => ollama.pull(name, signal));
  });

  router.add("admin", "POST /api/admin/models/delete", async ({ req, res, user }) => {
    const { name } = parse(schemas.modelName, await readJson(req));
    log(`${user.username} deleting ${name}`);
    if (!(await ollama.remove(name))) throw new HttpError(400, "Could not delete model");
    sendJson(res, 200, { ok: true });
  });

  router.add("admin", "PATCH /api/admin/users/:id", async ({ req, res, user, params }) => {
    const target = targetUser(user.id, params.id);
    const changes = parse(schemas.patchUser, await readJson(req));
    users.update(target.id, changes);
    if (changes.approved === false) sessions.destroyAllFor(target.id);
    log(`${user.username} updated ${target.username}: ${JSON.stringify(changes)}`);
    sendJson(res, 200, users.findById(target.id));
  });

  router.add("admin", "POST /api/admin/users/:id/reset-password", async ({ res, user, params }) => {
    const target = targetUser(user.id, params.id);
    const password = randomPassword();
    users.update(target.id, { passwordHash: await hashPassword(password) });
    sessions.destroyAllFor(target.id);
    log(`${user.username} reset password of ${target.username}`);
    sendJson(res, 200, { password });
  });

  router.add("admin", "DELETE /api/admin/users/:id", ({ res, user, params }) => {
    const target = targetUser(user.id, params.id);
    users.remove(target.id);
    log(`${user.username} deleted ${target.username}`);
    sendJson(res, 200, { ok: true });
  });
}
