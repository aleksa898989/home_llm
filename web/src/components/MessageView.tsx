import { memo } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage } from "../../../shared/api.ts";

const markdownComponents: Components = {
  a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
};

interface Props {
  message: ChatMessage;
  pending?: boolean;
}

export const MessageView = memo(function MessageView({ message, pending }: Props) {
  if (message.role === "user") {
    return (
      <article className="message message-user">
        <div className="bubble">{message.content}</div>
      </article>
    );
  }

  return (
    <article className="message message-assistant">
      {message.model && <div className="message-meta">{message.model}</div>}
      {message.thinking && (
        <details className="thinking">
          <summary>Thinking</summary>
          {message.thinking}
        </details>
      )}
      <div className={`markdown${pending ? " cursor" : ""}`}>
        <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {message.content}
        </Markdown>
      </div>
      {message.error && <p className="error small">{message.error}</p>}
    </article>
  );
});
