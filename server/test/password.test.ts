import { describe, expect, it } from "vitest";
import { hashPassword, randomPassword, verifyPassword } from "../src/auth/password.ts";

describe("password hashing", () => {
  it("verifies the right password and rejects the wrong one", async () => {
    const hash = await hashPassword("correct horse");
    expect(hash).toMatch(/^scrypt\$/);
    expect(await verifyPassword("correct horse", hash)).toBe(true);
    expect(await verifyPassword("wrong horse", hash)).toBe(false);
  });

  it("salts every hash", async () => {
    expect(await hashPassword("same")).not.toBe(await hashPassword("same"));
  });

  it("rejects malformed stored hashes", async () => {
    expect(await verifyPassword("x", "")).toBe(false);
    expect(await verifyPassword("x", "md5$abc$def")).toBe(false);
  });

  it("generates random passwords long enough to pass validation", () => {
    const a = randomPassword();
    expect(a.length).toBeGreaterThanOrEqual(12);
    expect(a).not.toBe(randomPassword());
  });
});
