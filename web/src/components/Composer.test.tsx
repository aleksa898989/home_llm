import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Composer } from "./Composer.tsx";

const setup = (props: Partial<Parameters<typeof Composer>[0]> = {}) => {
  const onSend = vi.fn();
  const onStop = vi.fn();
  render(
    <Composer disabled={false} streaming={false} onSend={onSend} onStop={onStop} {...props} />,
  );
  return { onSend, onStop, input: screen.getByRole("textbox", { name: "Message" }) };
};

describe("Composer", () => {
  it("sends trimmed text on Enter and clears the input", async () => {
    const { onSend, input } = setup();
    await userEvent.type(input, "  hello  {Enter}");
    expect(onSend).toHaveBeenCalledWith("hello");
    expect(input).toHaveValue("");
  });

  it("inserts a newline on Shift+Enter", async () => {
    const { onSend, input } = setup();
    await userEvent.type(input, "a{Shift>}{Enter}{/Shift}b");
    expect(onSend).not.toHaveBeenCalled();
    expect(input).toHaveValue("a\nb");
  });

  it("does not send empty messages or when disabled", async () => {
    const { onSend, input } = setup({ disabled: true });
    await userEvent.type(input, "hi{Enter}");
    expect(onSend).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  it("turns into a Stop button while streaming", async () => {
    const { onStop } = setup({ streaming: true });
    await userEvent.click(screen.getByRole("button", { name: "Stop" }));
    expect(onStop).toHaveBeenCalled();
  });
});
