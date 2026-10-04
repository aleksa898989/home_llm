import type { AddressInfo } from "node:net";
import type { ModelInfo } from "../../shared/api.ts";
import { createApp } from "../src/app.ts";
import { createRateLimiter } from "../src/auth/rate-limit.ts";
import { openDatabase } from "../src/db.ts";
import type { OllamaChatRequest, OllamaClient } from "../src/ollama.ts";
import { createServices } from "../src/services.ts";

export const ndjson = (lines: unknown[]) =>
  new Response(lines.map((l) => JSON.stringify(l)).join("\n") + "\n", {
    headers: { "content-type": "application/x-ndjson" },
  });

export function createFakeOllama(models: string[] = ["tiny:1b", "big:7b"]) {
  const calls: { chat: OllamaChatRequest[]; pulled: string[]; removed: string[] } = {
    chat: [],
    pulled: [],
    removed: [],
  };
  const client: OllamaClient = {
    listModels: async () => models.map((name): ModelInfo => ({ name, size: 1e9 })),
    chat: async (request) => {
      calls.chat.push(request);
      return ndjson([
        { message: { role: "assistant", content: "Hello" }, done: false },
        { message: { role: "assistant", content: " there" }, done: true },
      ]);
    },
    pull: async (model) => {
      calls.pulled.push(model);
      return ndjson([{ status: "success" }]);
    },
    remove: async (model) => {
      calls.removed.push(model);
      return true;
    },
  };
  return { client, calls };
}

export class TestClient {
  cookie = "";
  readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async request(
    method: string,
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ) {
    const res = await fetch(this.baseUrl + path, {
      method,
      headers: {
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        ...(this.cookie ? { cookie: this.cookie } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) this.cookie = setCookie.split(";")[0]!;
    const text = await res.text();
    let data: unknown = text;
    try {
      data = JSON.parse(text);
    } catch {
      /* not JSON (static file or stream) */
    }
    return { status: res.status, data: data as any, headers: res.headers, text };
  }

  get = (path: string) => this.request("GET", path);
  post = (path: string, body: unknown = {}) => this.request("POST", path, body);
  put = (path: string, body: unknown) => this.request("PUT", path, body);
  patch = (path: string, body: unknown) => this.request("PATCH", path, body);
  delete = (path: string) => this.request("DELETE", path);
}

export async function startTestApp({ webDir }: { webDir?: string } = {}) {
  const services = createServices(openDatabase(":memory:"));
  const ollama = createFakeOllama();
  const server = createApp({
    services,
    ollama: ollama.client,
    webDir,
    limiters: {
      login: createRateLimiter({ max: 3, windowMs: 60_000 }),
      register: createRateLimiter({ max: 100, windowMs: 60_000 }),
    },
    log: () => {},
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;

  const client = () => new TestClient(baseUrl);

  const admin = client();
  const signUpAdmin = async () => {
    await admin.post("/api/auth/register", { username: "admin", password: "admin-password" });
    return admin;
  };

  const approvedUser = async (username: string) => {
    const user = client();
    await user.post("/api/auth/register", { username, password: `${username}-password` });
    const { id } = services.users.findCredentials(username)!.user;
    services.users.update(id, { approved: true });
    await user.post("/api/auth/login", { username, password: `${username}-password` });
    return user;
  };

  return {
    baseUrl,
    services,
    ollama,
    client,
    signUpAdmin,
    approvedUser,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

export type TestApp = Awaited<ReturnType<typeof startTestApp>>;
