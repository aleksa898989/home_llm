import crypto from "node:crypto";
import { hashPassword, verifyPassword } from "../auth/password.ts";
import { SESSION_TTL_SECONDS } from "../auth/sessions.ts";
import { HttpError } from "../errors.ts";
import { clientIp, isProxied, readJson } from "../http/request.ts";
import { sendJson, setCookie } from "../http/response.ts";
import type { PublicContext, Router } from "../http/router.ts";
import { UsernameTakenError } from "../repos/users.ts";
import { parse, schemas } from "../validation.ts";
import { SESSION_COOKIE, type RouteDeps } from "./deps.ts";

const DUMMY_HASH = await hashPassword(crypto.randomBytes(16).toString("hex"));

export function registerAuthRoutes(router: Router, deps: RouteDeps) {
  const { users, sessions, limiters, log } = deps;

  const startSession = ({ req, res }: PublicContext, userId: number) =>
    setCookie(req, res, SESSION_COOKIE, sessions.create(userId), SESSION_TTL_SECONDS);

  router.add("public", "GET /api/auth/status", ({ req, res }) =>
    sendJson(res, 200, { needsSetup: users.count() === 0, canSetup: !isProxied(req) }),
  );

  router.add("public", "POST /api/auth/register", async (ctx) => {
    const { req, res } = ctx;
    const key = clientIp(req);
    limiters.register.check(key);
    const { username, password } = parse(schemas.register, await readJson(req));
    limiters.register.hit(key);

    const first = users.count() === 0;
    if (first && isProxied(req))
      throw new HttpError(403, "Create the admin account on the host machine first.");

    let user;
    try {
      user = users.create(username, await hashPassword(password), {
        admin: first,
        approved: first,
      });
    } catch (e) {
      if (e instanceof UsernameTakenError) throw new HttpError(409, e.message);
      throw e;
    }
    log(`registered ${user.username}${first ? " (admin)" : " (pending)"}`);

    if (first) startSession(ctx, user.id);
    sendJson(res, 201, { status: first ? "active" : "pending" });
  });

  router.add("public", "POST /api/auth/login", async (ctx) => {
    const { req, res } = ctx;
    const key = clientIp(req);
    limiters.login.check(key);
    const { username, password } = parse(schemas.login, await readJson(req));

    const found = users.findCredentials(username);
    const valid = await verifyPassword(password, found?.passwordHash ?? DUMMY_HASH);
    if (!found || !valid) {
      limiters.login.hit(key);
      throw new HttpError(401, "Wrong username or password");
    }
    limiters.login.reset(key);
    if (!found.user.approved) throw new HttpError(403, "Your account is waiting for approval");

    startSession(ctx, found.user.id);
    sendJson(res, 200, found.user);
  });

  router.add("user", "POST /api/auth/logout", ({ req, res, sessionToken }) => {
    sessions.destroy(sessionToken);
    setCookie(req, res, SESSION_COOKIE, "", 0);
    sendJson(res, 200, { ok: true });
  });

  router.add("user", "POST /api/auth/password", async (ctx) => {
    const { req, res, user } = ctx;
    const { current, next } = parse(schemas.changePassword, await readJson(req));
    const { passwordHash } = users.findCredentials(user.username)!;
    if (!(await verifyPassword(current, passwordHash)))
      throw new HttpError(400, "Current password is wrong");

    users.update(user.id, { passwordHash: await hashPassword(next) });
    sessions.destroyAllFor(user.id);
    startSession(ctx, user.id);
    sendJson(res, 200, { ok: true });
  });

  router.add("user", "GET /api/me", ({ res, user }) => sendJson(res, 200, user));
}
