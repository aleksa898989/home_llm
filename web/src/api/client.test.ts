import { afterEach, describe, expect, it, vi } from "vitest";
import { mockFetch, jsonResponse, streamResponse } from "../test-utils.ts";
import { ApiError, readNdjson, request, setUnauthorizedHandler } from "./client.ts";

afterEach(() => vi.unstubAllGlobals());

const collect = async <T>(gen: AsyncGenerator<T>) => {
  const out: T[] = [];
  for await (const item of gen) out.push(item);
  return out;
};

describe("readNdjson", () => {
  it("parses lines split across chunks", async () => {
    const res = streamResponse(['{"a":1}\n{"a"', ':2}\n\n{"a":3}']);
    expect(await collect(readNdjson(res))).toEqual([{ a: 1 }, { a: 2 }, { a: 3 }]);
  });
});

describe("request", () => {
  it("throws ApiError with the server message", async () => {
    mockFetch({ "GET /api/x": () => jsonResponse({ error: "Nope" }, 400) });
    await expect(request("GET", "/api/x")).rejects.toEqual(new ApiError(400, "Nope"));
  });

  it("sends JSON bodies", async () => {
    const calls = mockFetch({ "POST /api/x": () => jsonResponse({}) });
    await request("POST", "/api/x", { a: 1 });
    expect(calls[0]).toMatchObject({ method: "POST", body: { a: 1 } });
  });

  it("calls the unauthorized handler on 401 outside auth routes", async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    mockFetch({
      "GET /api/chats": () => jsonResponse({ error: "Not signed in" }, 401),
      "POST /api/auth/login": () => jsonResponse({ error: "Wrong" }, 401),
    });
    await expect(request("POST", "/api/auth/login", {})).rejects.toThrow("Wrong");
    expect(handler).not.toHaveBeenCalled();
    await expect(request("GET", "/api/chats")).rejects.toThrow();
    expect(handler).toHaveBeenCalledOnce();
  });
});
