import http from "node:http";
import { createRateLimiter, type RateLimiter } from "./auth/rate-limit.ts";
import { HttpError } from "./errors.ts";
import { getCookie } from "./http/request.ts";
import { sendJson } from "./http/response.ts";
import { Router } from "./http/router.ts";
import { assertSameOrigin, setSecurityHeaders } from "./http/security.ts";
import { createStaticHandler } from "./http/static.ts";
import type { OllamaClient } from "./ollama.ts";
import { registerAdminRoutes } from "./routes/admin.ts";
import { registerAuthRoutes } from "./routes/auth.ts";
import { registerChatRoutes } from "./routes/chat.ts";
import { SESSION_COOKIE } from "./routes/deps.ts";
import type { Services } from "./services.ts";

export interface AppOptions {
  services: Services;
  ollama: OllamaClient;
  webDir?: string;
  limiters?: { login: RateLimiter; register: RateLimiter };
  log?: (message: string) => void;
}

const isConnectionRefused = (e: unknown) =>
  (e as { cause?: { code?: string } }).cause?.code === "ECONNREFUSED";

export function createApp({
  services,
  ollama,
  webDir,
  limiters = {
    login: createRateLimiter({ max: 10, windowMs: 15 * 60_000 }),
    register: createRateLimiter({ max: 5, windowMs: 60 * 60_000 }),
  },
  log = (message) => console.log(`[${new Date().toISOString()}] ${message}`),
}: AppOptions) {
  const deps = { ...services, ollama, limiters, log };
  const router = new Router();
  registerAuthRoutes(router, deps);
  registerChatRoutes(router, deps);
  registerAdminRoutes(router, deps);
  const serveStatic = webDir ? createStaticHandler(webDir) : undefined;

  const currentUser = (token: string | undefined) => {
    const userId = token ? services.sessions.userId(token) : undefined;
    const user = userId === undefined ? undefined : services.users.findById(userId);
    return user?.approved ? user : undefined;
  };

  return http.createServer(async (req, res) => {
    const { pathname } = new URL(req.url ?? "/", "http://localhost");
    const method = req.method ?? "GET";
    setSecurityHeaders(res);

    try {
      if (!pathname.startsWith("/api/")) {
        if (method !== "GET" && method !== "HEAD") throw new HttpError(405, "Method not allowed");
        if (!serveStatic) throw new HttpError(404, "Not found");
        return serveStatic(pathname, res);
      }

      const run = router.match(method, pathname);
      if (!run) throw new HttpError(404, "Not found");
      assertSameOrigin(req);

      const sessionToken = getCookie(req, SESSION_COOKIE);
      await run({ req, res, user: currentUser(sessionToken), sessionToken });
    } catch (e) {
      if (res.headersSent) return void res.end();
      if (e instanceof HttpError) return sendJson(res, e.status, { error: e.message });
      if (isConnectionRefused(e)) return sendJson(res, 503, { error: "Ollama is not running" });
      console.error(e);
      sendJson(res, 500, { error: "Server error" });
    }
  });
}
