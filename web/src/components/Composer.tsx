import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";

interface Props {
  disabled: boolean;
  streaming: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
}

const hasFinePointer = () => window.matchMedia?.("(pointer: fine)").matches ?? true;

export function Composer({ disabled, streaming, onSend, onStop }: Props) {
  const [text, setText] = useState("");
  const textarea = useRef<HTMLTextAreaElement>(null);

  const resize = () => {
    const el = textarea.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  function submit(e?: FormEvent) {
    e?.preventDefault();
    if (streaming) return onStop();
    const value = text.trim();
    if (!value || disabled) return;
    onSend(value);
    setText("");
    requestAnimationFrame(resize);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && hasFinePointer()) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <form className="composer" onSubmit={submit}>
      <div className="composer-box">
        <textarea
          ref={textarea}
          rows={1}
          value={text}
          placeholder="Message…"
          aria-label="Message"
          onChange={(e) => {
            setText(e.target.value);
            resize();
          }}
          onKeyDown={onKeyDown}
        />
        <button
          className={`btn ${streaming ? "" : "btn-primary"}`}
          type="submit"
          disabled={!streaming && (disabled || !text.trim())}
        >
          {streaming ? "Stop" : "Send"}
        </button>
      </div>
    </form>
  );
}
