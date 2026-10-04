import { describe, expect, it } from "vitest";
import { createRateLimiter } from "../src/auth/rate-limit.ts";
import { HttpError } from "../src/errors.ts";

describe("rate limiter", () => {
  const setup = () => {
    let now = 0;
    const limiter = createRateLimiter({ max: 2, windowMs: 1_000, now: () => now });
    return { limiter, advance: (ms: number) => (now += ms) };
  };

  it("blocks after max hits within the window", () => {
    const { limiter } = setup();
    limiter.hit("ip");
    limiter.hit("ip");
    expect(() => limiter.check("ip")).toThrow(HttpError);
    expect(() => limiter.check("other-ip")).not.toThrow();
  });

  it("allows again once the window has passed", () => {
    const { limiter, advance } = setup();
    limiter.hit("ip");
    limiter.hit("ip");
    advance(1_001);
    expect(() => limiter.check("ip")).not.toThrow();
  });

  it("reset clears the counter", () => {
    const { limiter } = setup();
    limiter.hit("ip");
    limiter.hit("ip");
    limiter.reset("ip");
    expect(() => limiter.check("ip")).not.toThrow();
  });
});
