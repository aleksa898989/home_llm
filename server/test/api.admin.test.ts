import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { startTestApp, type TestApp, type TestClient } from "./helpers.ts";

let app: TestApp;
let admin: TestClient;
beforeEach(async () => {
  app = await startTestApp();
  admin = await app.signUpAdmin();
});
afterEach(() => app.close());

const idOf = (username: string) => app.services.users.findCredentials(username)!.user.id;

describe("admin access", () => {
  it("is denied to regular users", async () => {
    const mom = await app.approvedUser("mom");
    for (const [method, path] of [
      ["GET", "/api/admin/state"],
      ["PUT", "/api/admin/config"],
      ["PATCH", `/api/admin/users/${idOf("admin")}`],
    ] as const)
      expect((await mom.request(method, path, method === "GET" ? undefined : {})).status).toBe(403);
  });

  it("returns installed models, config and users", async () => {
    const { data } = await admin.get("/api/admin/state");
    expect(data.installed).toHaveLength(2);
    expect(data.users.map((u: { username: string }) => u.username)).toEqual(["admin"]);
    expect(JSON.stringify(data)).not.toMatch(/password|scrypt/);
  });
});

describe("user management", () => {
  it("approves a pending user, who can then sign in", async () => {
    const mom = app.client();
    await mom.post("/api/auth/register", { username: "mom", password: "mom-password" });
    const res = await admin.patch(`/api/admin/users/${idOf("mom")}`, { approved: true });
    expect(res.data).toMatchObject({ username: "mom", approved: true });
    expect(
      (await mom.post("/api/auth/login", { username: "mom", password: "mom-password" })).status,
    ).toBe(200);
  });

  it("blocking a user ends their sessions immediately", async () => {
    const mom = await app.approvedUser("mom");
    await admin.patch(`/api/admin/users/${idOf("mom")}`, { approved: false });
    expect((await mom.get("/api/me")).status).toBe(401);
  });

  it("resetting a password returns a new one and signs the user out", async () => {
    const mom = await app.approvedUser("mom");
    const { data } = await admin.post(`/api/admin/users/${idOf("mom")}/reset-password`);
    expect((await mom.get("/api/me")).status).toBe(401);
    const login = await app
      .client()
      .post("/api/auth/login", { username: "mom", password: data.password });
    expect(login.status).toBe(200);
  });

  it("deletes users", async () => {
    await app.approvedUser("mom");
    await admin.delete(`/api/admin/users/${idOf("mom")}`);
    expect(app.services.users.findCredentials("mom")).toBeUndefined();
  });

  it("won't let an admin lock themselves out", async () => {
    const self = `/api/admin/users/${idOf("admin")}`;
    expect((await admin.patch(self, { isAdmin: false })).status).toBe(400);
    expect((await admin.delete(self)).status).toBe(400);
  });
});

describe("model management", () => {
  it("saves model config", async () => {
    await admin.put("/api/admin/config", { enabled: ["tiny:1b"], default: "tiny:1b" });
    expect(app.services.settings.modelConfig()).toEqual({
      enabled: ["tiny:1b"],
      default: "tiny:1b",
    });
  });

  it("pulls and deletes models through Ollama", async () => {
    const pull = await admin.post("/api/admin/models/pull", { name: "llama3.2:3b" });
    expect(pull.text).toContain("success");
    await admin.post("/api/admin/models/delete", { name: "tiny:1b" });
    expect(app.ollama.calls).toMatchObject({ pulled: ["llama3.2:3b"], removed: ["tiny:1b"] });
  });
});
