import type { IncomingMessage, ServerResponse } from "node:http";
import { describe, expect, it, vi } from "vitest";
import { HttpError } from "../src/errors.ts";
import { Router } from "../src/http/router.ts";
import type { User } from "../src/repos/users.ts";

const req = {} as IncomingMessage;
const res = {} as ServerResponse;
const user = (isAdmin: boolean): User => ({
  id: 1,
  username: "u",
  isAdmin,
  approved: true,
  createdAt: 0,
});

describe("Router", () => {
  it("matches method, path and params", () => {
    const handler = vi.fn();
    const router = new Router().add("public", "GET /api/items/:id", handler);
    router.match("GET", "/api/items/a%20b")!({ req, res });
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ params: { id: "a b" } }));
    expect(router.match("POST", "/api/items/1")).toBeUndefined();
    expect(router.match("GET", "/api/items/1/extra")).toBeUndefined();
  });

  it("requires a session for user routes", () => {
    const router = new Router().add("user", "GET /api/x", vi.fn());
    const run = router.match("GET", "/api/x")!;
    expect(() => run({ req, res })).toThrow(expect.objectContaining({ status: 401 }));
    expect(() => run({ req, res, user: user(false), sessionToken: "t" })).not.toThrow();
  });

  it("requires admin for admin routes", () => {
    const router = new Router().add("admin", "GET /api/admin", vi.fn());
    const run = router.match("GET", "/api/admin")!;
    expect(() => run({ req, res, user: user(false), sessionToken: "t" })).toThrow(HttpError);
    expect(() => run({ req, res, user: user(true), sessionToken: "t" })).not.toThrow();
  });
});
