import { useCallback, useRef, useState } from "react";
import type { Chat, ChatMessage } from "../../../shared/api.ts";
import { chatApi } from "../api/endpoints.ts";

const newChat = (title: string): Chat => ({
  id: crypto.randomUUID(),
  title: title.slice(0, 60),
  model: null,
  messages: [],
  updatedAt: Date.now() / 1000,
});

export function useChatSession(onSaved: () => void) {
  const [chat, setChat] = useState<Chat | null>(null);
  const [streaming, setStreaming] = useState(false);
  const controller = useRef<AbortController | null>(null);

  const open = useCallback(async (id: string) => {
    const loaded = await chatApi.get(id);
    setChat(loaded);
    return loaded;
  }, []);
  const reset = useCallback(() => setChat(null), []);
  const stop = useCallback(() => controller.current?.abort(), []);

  const send = useCallback(
    async (text: string, model: string) => {
      const base = chat ?? newChat(text);
      const history: ChatMessage[] = [...base.messages, { role: "user", content: text }];
      const reply: ChatMessage = { role: "assistant", model, content: "" };
      const update = () => setChat({ ...base, model, messages: [...history, { ...reply }] });
      update();

      controller.current = new AbortController();
      setStreaming(true);
      try {
        for await (const chunk of chatApi.stream(model, history, controller.current.signal)) {
          if (chunk.error) throw new Error(chunk.error);
          reply.content += chunk.message?.content ?? "";
          if (chunk.message?.thinking)
            reply.thinking = (reply.thinking ?? "") + chunk.message.thinking;
          update();
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") reply.error = (e as Error).message;
        update();
      } finally {
        controller.current = null;
        setStreaming(false);
        await chatApi.save({ ...base, model, messages: [...history, reply] });
        onSaved();
      }
    },
    [chat, onSaved],
  );

  return { chat, streaming, open, reset, send, stop };
}
