import { describe, expect, it } from "vitest";
import { HttpError } from "../src/errors.ts";
import { parse, schemas } from "../src/validation.ts";

describe("validation", () => {
  it("accepts valid registrations and trims usernames", () => {
    expect(parse(schemas.register, { username: " mom ", password: "12345678" })).toEqual({
      username: "mom",
      password: "12345678",
    });
  });

  it.each([
    [{ username: "a", password: "12345678" }, /Username/],
    [{ username: "has space", password: "12345678" }, /Username/],
    [{ username: "mom", password: "short" }, /at least 8/],
    [{ username: "mom" }, /./],
  ])("rejects %j", (input, message) => {
    expect(() => parse(schemas.register, input)).toThrow(message);
  });

  it("throws HttpError 400", () => {
    try {
      parse(schemas.chatId, "../etc");
    } catch (e) {
      expect(e).toBeInstanceOf(HttpError);
      expect((e as HttpError).status).toBe(400);
    }
  });

  it("rejects model names that could be abused", () => {
    expect(() => parse(schemas.modelName, { name: "llama3.2:3b" })).not.toThrow();
    expect(() => parse(schemas.modelName, { name: "a b; rm -rf" })).toThrow();
  });
});
