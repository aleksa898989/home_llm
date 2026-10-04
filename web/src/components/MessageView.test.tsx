import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MessageView } from "./MessageView.tsx";

describe("MessageView", () => {
  it("renders assistant markdown", () => {
    render(
      <MessageView message={{ role: "assistant", content: "**bold** and `code`", model: "m" }} />,
    );
    expect(screen.getByText("bold").tagName).toBe("STRONG");
    expect(screen.getByText("code").tagName).toBe("CODE");
    expect(screen.getByText("m")).toBeInTheDocument();
  });

  it("never renders raw HTML from the model", () => {
    const { container } = render(
      <MessageView
        message={{
          role: "assistant",
          content: '<img src=x onerror="alert(1)"><script>alert(2)</script>',
        }}
      />,
    );
    expect(container.querySelector("img, script")).toBeNull();
  });

  it("opens links in a new tab without leaking the opener", () => {
    render(<MessageView message={{ role: "assistant", content: "[site](https://example.com)" }} />);
    const link = screen.getByRole("link", { name: "site" });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("drops javascript: links", () => {
    render(<MessageView message={{ role: "assistant", content: "[x](javascript:alert(1))" }} />);
    expect(screen.getByText("x").closest("a")?.getAttribute("href") ?? "").not.toMatch(
      /javascript/,
    );
  });

  it("shows user messages as plain text", () => {
    render(<MessageView message={{ role: "user", content: "**not bold**" }} />);
    expect(screen.getByText("**not bold**")).toBeInTheDocument();
  });

  it("shows thinking and errors", () => {
    render(
      <MessageView message={{ role: "assistant", content: "", thinking: "hmm", error: "Oops" }} />,
    );
    expect(screen.getByText("hmm")).toBeInTheDocument();
    expect(screen.getByText("Oops")).toBeInTheDocument();
  });
});
