import { beforeEach, describe, expect, it } from "vitest";
import { openDatabase } from "../src/db.ts";
import { ChatOwnershipError } from "../src/repos/chats.ts";
import { UsernameTakenError } from "../src/repos/users.ts";
import { createServices, type Services } from "../src/services.ts";

let s: Services;
beforeEach(() => {
  s = createServices(openDatabase(":memory:"));
});

describe("users repo", () => {
  it("creates users with case-insensitive unique names", () => {
    const user = s.users.create("Mom", "hash");
    expect(user).toMatchObject({ username: "Mom", isAdmin: false, approved: false });
    expect(() => s.users.create("mom", "hash")).toThrow(UsernameTakenError);
    expect(s.users.findCredentials("MOM")?.user.id).toBe(user.id);
  });

  it("updates only the given fields", () => {
    const { id } = s.users.create("a", "hash");
    s.users.update(id, { approved: true });
    expect(s.users.findById(id)).toMatchObject({ approved: true, isAdmin: false });
    expect(s.users.findCredentials("a")?.passwordHash).toBe("hash");
  });

  it("deleting a user removes their sessions and chats", () => {
    const { id } = s.users.create("a", "hash");
    const token = s.sessions.create(id);
    s.chats.save(id, { id: "c1", title: "t", model: null, messages: [] });
    s.users.remove(id);
    expect(s.sessions.userId(token)).toBeUndefined();
    expect(s.chats.list(id)).toEqual([]);
  });
});

describe("sessions", () => {
  it("resolves tokens and can be destroyed", () => {
    const { id } = s.users.create("a", "hash");
    const token = s.sessions.create(id);
    expect(s.sessions.userId(token)).toBe(id);
    expect(s.sessions.userId("not-a-token")).toBeUndefined();
    s.sessions.destroy(token);
    expect(s.sessions.userId(token)).toBeUndefined();
  });

  it("destroyAllFor signs a user out everywhere", () => {
    const { id } = s.users.create("a", "hash");
    const tokens = [s.sessions.create(id), s.sessions.create(id)];
    s.sessions.destroyAllFor(id);
    for (const t of tokens) expect(s.sessions.userId(t)).toBeUndefined();
  });
});

describe("chats repo", () => {
  it("scopes chats to their owner", () => {
    const a = s.users.create("a", "hash");
    const b = s.users.create("b", "hash");
    s.chats.save(a.id, {
      id: "c1",
      title: "secret",
      model: null,
      messages: [{ role: "user", content: "hi" }],
    });

    expect(s.chats.get(a.id, "c1")?.messages).toEqual([{ role: "user", content: "hi" }]);
    expect(s.chats.get(b.id, "c1")).toBeUndefined();
    expect(s.chats.list(b.id)).toEqual([]);
    expect(() => s.chats.save(b.id, { id: "c1", title: "x", model: null, messages: [] })).toThrow(
      ChatOwnershipError,
    );
    s.chats.remove(b.id, "c1");
    expect(s.chats.get(a.id, "c1")?.title).toBe("secret");
  });
});

describe("settings repo", () => {
  it("round-trips model config", () => {
    expect(s.settings.modelConfig()).toEqual({ enabled: [], default: null });
    s.settings.saveModelConfig({ enabled: ["a"], default: "a" });
    expect(s.settings.modelConfig()).toEqual({ enabled: ["a"], default: "a" });
  });
});
