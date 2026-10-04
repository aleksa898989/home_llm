import type { IncomingMessage, ServerResponse } from "node:http";
import { HttpError } from "../errors.ts";
import type { User } from "../repos/users.ts";

export type Access = "public" | "user" | "admin";

export interface RequestContext {
  req: IncomingMessage;
  res: ServerResponse;
  params: Record<string, string>;
  user?: User;
  sessionToken?: string;
}

export type PublicContext = Omit<RequestContext, "user" | "sessionToken">;
export type AuthedContext = PublicContext & { user: User; sessionToken: string };

type Handler<A extends Access> = (
  ctx: A extends "public" ? PublicContext : AuthedContext,
) => unknown;

interface Route {
  method: string;
  pattern: RegExp;
  keys: string[];
  run: (ctx: RequestContext) => unknown;
}

export class Router {
  readonly #routes: Route[] = [];

  add<A extends Access>(access: A, spec: `${string} /${string}`, handler: Handler<A>): this {
    const [method, path] = spec.split(" ") as [string, string];
    const keys: string[] = [];
    const source = path.replace(/:(\w+)/g, (_, key: string) => {
      keys.push(key);
      return "([^/]+)";
    });

    const run = (ctx: RequestContext) => {
      if (access === "public") return (handler as Handler<"public">)(ctx);
      const { user, sessionToken } = ctx;
      if (!user || !sessionToken) throw new HttpError(401, "Not signed in");
      if (access === "admin" && !user.isAdmin) throw new HttpError(403, "Admin only");
      return (handler as Handler<"user">)({ ...ctx, user, sessionToken });
    };

    this.#routes.push({ method, pattern: new RegExp(`^${source}$`), keys, run });
    return this;
  }

  match(method: string, pathname: string) {
    for (const route of this.#routes) {
      if (route.method !== method) continue;
      const match = route.pattern.exec(pathname);
      if (!match) continue;
      const params = Object.fromEntries(
        route.keys.map((key, i) => [key, decodeURIComponent(match[i + 1]!)]),
      );
      return (ctx: Omit<RequestContext, "params">) => route.run({ ...ctx, params });
    }
  }
}
