import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { jsonResponse, streamResponse } from "../test-utils.ts";
import { useChatSession } from "./useChatSession.ts";

afterEach(() => vi.unstubAllGlobals());

const chunk = (content: string, extra = {}) =>
  JSON.stringify({ message: { role: "assistant", content, ...extra } }) + "\n";

describe("useChatSession", () => {
  it("streams a reply, then saves the chat and notifies", async () => {
    const calls: { method: string; path: string; body: unknown }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string, init?: RequestInit) => {
        const body = init?.body ? JSON.parse(String(init.body)) : undefined;
        calls.push({ method: init?.method ?? "GET", path: input, body });
        return input === "/api/chat"
          ? streamResponse([chunk("Hel"), chunk("lo", { thinking: "hmm" })])
          : jsonResponse({ ok: true });
      }),
    );

    const onSaved = vi.fn();
    const { result } = renderHook(() => useChatSession(onSaved));

    await act(() => result.current.send("Hi there", "tiny:1b"));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const chat = result.current.chat!;
    expect(chat.title).toBe("Hi there");
    expect(chat.messages).toEqual([
      { role: "user", content: "Hi there" },
      { role: "assistant", model: "tiny:1b", content: "Hello", thinking: "hmm" },
    ]);
    expect(result.current.streaming).toBe(false);

    const save = calls.find((c) => c.method === "PUT")!;
    expect(save.path).toBe(`/api/chats/${chat.id}`);
    expect(save.body).toMatchObject({
      title: "Hi there",
      model: "tiny:1b",
      messages: chat.messages,
    });
    expect(calls[0]!.body).toEqual({
      model: "tiny:1b",
      messages: [{ role: "user", content: "Hi there" }],
    });
  });

  it("records server errors on the reply", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) =>
        input === "/api/chat"
          ? jsonResponse({ error: "Model not available" }, 400)
          : jsonResponse({ ok: true }),
      ),
    );
    const { result } = renderHook(() => useChatSession(vi.fn()));
    await act(() => result.current.send("Hi", "gone:1b"));
    expect(result.current.chat!.messages.at(-1)).toMatchObject({ error: "Model not available" });
  });
});
