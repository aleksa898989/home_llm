import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { jsonResponse, mockFetch } from "../test-utils.ts";
import { AuthPage } from "./AuthPage.tsx";

afterEach(() => vi.unstubAllGlobals());

const status =
  (needsSetup: boolean, canSetup = true) =>
  () =>
    jsonResponse({ needsSetup, canSetup });

async function fill(username: string, password: string, confirm?: string) {
  await userEvent.type(screen.getByLabelText("Username"), username);
  await userEvent.type(screen.getByLabelText("Password"), password);
  if (confirm !== undefined)
    await userEvent.type(screen.getByLabelText("Repeat password"), confirm);
}

describe("AuthPage", () => {
  it("signs in", async () => {
    const calls = mockFetch({
      "GET /api/auth/status": status(false),
      "POST /api/auth/login": () => jsonResponse({ id: 1 }),
    });
    const onSignedIn = vi.fn();
    render(<AuthPage onSignedIn={onSignedIn} />);

    await fill("mom", "secret-pass");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(onSignedIn).toHaveBeenCalled());
    expect(calls.at(-1)?.body).toEqual({ username: "mom", password: "secret-pass" });
  });

  it("shows the server error on failed sign in", async () => {
    mockFetch({
      "GET /api/auth/status": status(false),
      "POST /api/auth/login": () => jsonResponse({ error: "Wrong username or password" }, 401),
    });
    render(<AuthPage onSignedIn={vi.fn()} />);
    await fill("mom", "bad-pass");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Wrong username or password");
  });

  it("tells new users to wait for approval", async () => {
    mockFetch({
      "GET /api/auth/status": status(false),
      "POST /api/auth/register": () => jsonResponse({ status: "pending" }, 201),
    });
    const onSignedIn = vi.fn();
    render(<AuthPage onSignedIn={onSignedIn} />);

    await userEvent.click(screen.getByRole("tab", { name: "Register" }));
    await fill("kid", "kid-password", "kid-password");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByRole("status")).toHaveTextContent(/approves/);
    expect(onSignedIn).not.toHaveBeenCalled();
  });

  it("checks that passwords match before calling the server", async () => {
    const calls = mockFetch({ "GET /api/auth/status": status(false) });
    render(<AuthPage onSignedIn={vi.fn()} />);
    await userEvent.click(screen.getByRole("tab", { name: "Register" }));
    await fill("kid", "kid-password", "different");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Passwords don't match");
    expect(calls).toHaveLength(1);
  });

  it("goes straight to admin registration on first run", async () => {
    mockFetch({ "GET /api/auth/status": status(true) });
    render(<AuthPage onSignedIn={vi.fn()} />);
    expect(await screen.findByText(/create the admin account/)).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.getByLabelText("Repeat password")).toBeInTheDocument();
  });

  it("disables the form when setup is only allowed on the host", async () => {
    mockFetch({ "GET /api/auth/status": status(true, false) });
    render(<AuthPage onSignedIn={vi.fn()} />);
    expect(await screen.findByText(/isn't set up yet/)).toBeInTheDocument();
    expect(screen.getByLabelText("Username")).toBeDisabled();
  });
});
