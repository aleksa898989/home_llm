import { useEffect, useRef } from "react";
import type { ChatMessage } from "../../../shared/api.ts";
import { MessageView } from "./MessageView.tsx";

interface Props {
  messages: ChatMessage[];
  streaming: boolean;
  emptyText: string;
}

export function MessageList({ messages, streaming, emptyText }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  useEffect(() => {
    const el = ref.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const onScroll = () => {
    const el = ref.current;
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  return (
    <div className="messages" ref={ref} onScroll={onScroll} aria-live="polite">
      {messages.length === 0 ? (
        <div className="empty">
          <h2>{emptyText}</h2>
        </div>
      ) : (
        messages.map((message, i) => (
          <MessageView key={i} message={message} pending={streaming && i === messages.length - 1} />
        ))
      )}
    </div>
  );
}
