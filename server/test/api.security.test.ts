import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestApp, type TestApp, type TestClient } from "./helpers.ts";

let webDir: string;
beforeAll(() => {
  webDir = fs.mkdtempSync(path.join(os.tmpdir(), "home-llm-web-"));
  fs.mkdirSync(path.join(webDir, "assets"));
  fs.writeFileSync(path.join(webDir, "index.html"), "<!doctype html><title>app</title>");
  fs.writeFileSync(path.join(webDir, "assets", "app.js"), "console.log(1)");
});
afterAll(() => fs.rmSync(webDir, { recursive: true }));

let app: TestApp;
let admin: TestClient;
beforeEach(async () => {
  app = await startTestApp({ webDir });
  admin = await app.signUpAdmin();
});
afterEach(() => app.close());

describe("CSRF protection", () => {
  it("rejects form-encoded POSTs", async () => {
    const res = await admin.request("POST", "/api/auth/logout", undefined, {
      "content-type": "application/x-www-form-urlencoded",
    });
    expect(res.status).toBe(415);
    expect((await admin.get("/api/me")).status).toBe(200);
  });

  it("rejects cross-origin writes", async () => {
    const res = await admin.request(
      "PUT",
      "/api/admin/config",
      { enabled: [], default: null },
      { origin: "https://evil.example" },
    );
    expect(res.status).toBe(403);
  });

  it("allows same-origin writes", async () => {
    const res = await admin.request(
      "PUT",
      "/api/admin/config",
      { enabled: [], default: null },
      { origin: app.baseUrl },
    );
    expect(res.status).toBe(200);
  });
});

describe("headers", () => {
  it("sets a strict CSP and anti-framing headers on every response", async () => {
    for (const path of ["/", "/api/me", "/api/nope"]) {
      const { headers } = await admin.get(path);
      expect(headers.get("content-security-policy")).toContain("script-src 'self'");
      expect(headers.get("content-security-policy")).not.toContain("unsafe-inline");
      expect(headers.get("x-frame-options")).toBe("DENY");
      expect(headers.get("x-content-type-options")).toBe("nosniff");
    }
  });
});

describe("static files", () => {
  it("serves the SPA for unknown paths and real assets with long caching", async () => {
    const page = await app.client().get("/some/route");
    expect(page.text).toContain("<title>app</title>");
    const asset = await app.client().get("/assets/app.js");
    expect(asset.headers.get("content-type")).toContain("javascript");
    expect(asset.headers.get("cache-control")).toContain("immutable");
  });

  it("does not allow path traversal", async () => {
    const res = await fetch(`${app.baseUrl}/assets/..%2F..%2F..%2Fetc%2Fpasswd`);
    expect(await res.text()).toContain("<title>app</title>");
  });

  it("unknown API routes are JSON 404s, not the SPA", async () => {
    const res = await admin.get("/api/does-not-exist");
    expect(res).toMatchObject({ status: 404, data: { error: "Not found" } });
  });
});
