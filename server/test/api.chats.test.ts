import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { startTestApp, type TestApp } from "./helpers.ts";

let app: TestApp;
beforeEach(async () => {
  app = await startTestApp();
  await app.signUpAdmin();
});
afterEach(() => app.close());

describe("models", () => {
  it("lists all installed models when nothing is configured", async () => {
    const user = await app.approvedUser("mom");
    const { data } = await user.get("/api/models");
    expect(data.models.map((m: { name: string }) => m.name)).toEqual(["tiny:1b", "big:7b"]);
    expect(data.default).toBe("tiny:1b");
  });

  it("only exposes enabled models and honours the default", async () => {
    app.services.settings.saveModelConfig({ enabled: ["big:7b"], default: "big:7b" });
    const user = await app.approvedUser("mom");
    const { data } = await user.get("/api/models");
    expect(data).toMatchObject({ default: "big:7b", models: [{ name: "big:7b" }] });
  });
});

describe("chat streaming", () => {
  it("streams the model reply as NDJSON", async () => {
    const user = await app.approvedUser("mom");
    const res = await user.post("/api/chat", {
      model: "tiny:1b",
      messages: [{ role: "user", content: "hi", thinking: "client-only field" }],
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/x-ndjson");
    const content = res.text
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line).message.content)
      .join("");
    expect(content).toBe("Hello there");
    expect(app.ollama.calls.chat[0]!.messages).toEqual([{ role: "user", content: "hi" }]);
  });

  it("refuses disabled models", async () => {
    app.services.settings.saveModelConfig({ enabled: ["tiny:1b"], default: null });
    const user = await app.approvedUser("mom");
    const res = await user.post("/api/chat", {
      model: "big:7b",
      messages: [{ role: "user", content: "hi" }],
    });
    expect(res.status).toBe(400);
    expect(app.ollama.calls.chat).toHaveLength(0);
  });
});

describe("chat history", () => {
  const chat = {
    title: "Secret plans",
    model: "tiny:1b",
    messages: [{ role: "user", content: "hi" }],
  };

  it("saves, lists, loads and deletes a user's chats", async () => {
    const user = await app.approvedUser("mom");
    expect((await user.put("/api/chats/c1", chat)).status).toBe(200);

    const list = await user.get("/api/chats");
    expect(list.data).toEqual([expect.objectContaining({ id: "c1", title: "Secret plans" })]);
    expect((await user.get("/api/chats/c1")).data.messages).toEqual(chat.messages);

    await user.delete("/api/chats/c1");
    expect((await user.get("/api/chats/c1")).status).toBe(404);
  });

  it("keeps chats private between users", async () => {
    const mom = await app.approvedUser("mom");
    const kid = await app.approvedUser("kid");
    await mom.put("/api/chats/c1", chat);

    expect((await kid.get("/api/chats")).data).toEqual([]);
    expect((await kid.get("/api/chats/c1")).status).toBe(404);
    expect((await kid.put("/api/chats/c1", { ...chat, title: "pwned" })).status).toBe(404);
    await kid.delete("/api/chats/c1");
    expect((await mom.get("/api/chats/c1")).data.title).toBe("Secret plans");
  });

  it("rejects invalid chat ids", async () => {
    const user = await app.approvedUser("mom");
    expect((await user.get("/api/chats/..%2F..%2Fetc")).status).toBe(400);
  });
});
