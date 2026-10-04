import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { startTestApp, type TestApp } from "./helpers.ts";

let app: TestApp;
beforeEach(async () => {
  app = await startTestApp();
});
afterEach(() => app.close());

const viaTunnel = { "x-forwarded-for": "203.0.113.7", "x-forwarded-proto": "https" };

describe("first-time setup", () => {
  it("reports that setup is needed", async () => {
    const { data } = await app.client().get("/api/auth/status");
    expect(data).toEqual({ needsSetup: true, canSetup: true });
  });

  it("refuses to create the first account through the tunnel", async () => {
    const res = await app
      .client()
      .request(
        "POST",
        "/api/auth/register",
        { username: "evil", password: "password1" },
        viaTunnel,
      );
    expect(res.status).toBe(403);
    expect(app.services.users.count()).toBe(0);
  });

  it("makes the first local account an approved admin and signs it in", async () => {
    const admin = await app.signUpAdmin();
    const { data } = await admin.get("/api/me");
    expect(data).toMatchObject({ username: "admin", isAdmin: true, approved: true });
  });
});

describe("registration", () => {
  beforeEach(() => app.signUpAdmin());

  it("creates pending accounts that can't sign in yet", async () => {
    const mom = app.client();
    const reg = await mom.post("/api/auth/register", { username: "mom", password: "mom-password" });
    expect(reg).toMatchObject({ status: 201, data: { status: "pending" } });
    expect(mom.cookie).toBe("");

    const login = await mom.post("/api/auth/login", { username: "mom", password: "mom-password" });
    expect(login.status).toBe(403);
    expect(login.data.error).toMatch(/approval/);
  });

  it("rejects duplicate usernames regardless of case", async () => {
    const res = await app
      .client()
      .post("/api/auth/register", { username: "ADMIN", password: "whatever1" });
    expect(res.status).toBe(409);
  });

  it("validates input", async () => {
    const res = await app.client().post("/api/auth/register", { username: "x", password: "1" });
    expect(res.status).toBe(400);
  });
});

describe("login", () => {
  beforeEach(() => app.signUpAdmin());

  it("signs in with correct credentials and sets a secure cookie behind https", async () => {
    const c = app.client();
    const res = await c.request(
      "POST",
      "/api/auth/login",
      { username: "admin", password: "admin-password" },
      viaTunnel,
    );
    expect(res.status).toBe(200);
    const cookie = res.headers.get("set-cookie")!;
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect(cookie).toMatch(/Secure/);
    expect((await c.get("/api/me")).status).toBe(200);
  });

  it("gives the same error for unknown users and wrong passwords", async () => {
    const unknown = await app
      .client()
      .post("/api/auth/login", { username: "nobody", password: "x" });
    const wrong = await app.client().post("/api/auth/login", { username: "admin", password: "x" });
    expect(unknown.status).toBe(401);
    expect(wrong.data).toEqual(unknown.data);
  });

  it("rate-limits repeated failures per client IP", async () => {
    const attempt = (ip: string) =>
      app
        .client()
        .request(
          "POST",
          "/api/auth/login",
          { username: "admin", password: "wrong" },
          { "x-forwarded-for": ip },
        );
    for (let i = 0; i < 3; i++) await attempt("198.51.100.1");
    expect((await attempt("198.51.100.1")).status).toBe(429);
    expect((await attempt("198.51.100.2")).status).toBe(401);
  });

  it("can't dodge the rate limit by spoofing X-Forwarded-For", async () => {
    const attempt = (spoofed: string) =>
      app
        .client()
        .request(
          "POST",
          "/api/auth/login",
          { username: "admin", password: "wrong" },
          { "x-forwarded-for": `${spoofed}, 198.51.100.9` },
        );
    for (let i = 0; i < 3; i++) await attempt(`10.0.0.${i}`);
    expect((await attempt("10.0.0.99")).status).toBe(429);
  });
});

describe("sessions", () => {
  it("logout invalidates the session server-side", async () => {
    const admin = await app.signUpAdmin();
    const cookie = admin.cookie;
    await admin.post("/api/auth/logout");
    const replay = app.client();
    replay.cookie = cookie;
    expect((await replay.get("/api/me")).status).toBe(401);
  });

  it("changing password signs out other devices but keeps this one", async () => {
    const laptop = await app.signUpAdmin();
    const phone = app.client();
    await phone.post("/api/auth/login", { username: "admin", password: "admin-password" });

    const wrong = await laptop.post("/api/auth/password", {
      current: "nope",
      next: "new-password",
    });
    expect(wrong.status).toBe(400);

    const ok = await laptop.post("/api/auth/password", {
      current: "admin-password",
      next: "new-password",
    });
    expect(ok.status).toBe(200);
    expect((await laptop.get("/api/me")).status).toBe(200);
    expect((await phone.get("/api/me")).status).toBe(401);
  });

  it("rejects unauthenticated API calls", async () => {
    for (const path of ["/api/me", "/api/chats", "/api/models"])
      expect((await app.client().get(path)).status).toBe(401);
  });
});
