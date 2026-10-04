import { useEffect, useState, type FormEvent } from "react";
import type { AuthStatus } from "../../../shared/api.ts";
import { authApi } from "../api/endpoints.ts";

type Mode = "login" | "register";

export function AuthPage({ onSignedIn }: { onSignedIn: () => void }) {
  const [status, setStatus] = useState<AuthStatus>();
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<{ text: string; ok?: boolean }>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    authApi
      .status()
      .then((s) => {
        setStatus(s);
        if (s.needsSetup) setMode("register");
      })
      .catch(() => setMessage({ text: "Can't reach the server" }));
  }, []);

  const setup = status?.needsSetup;
  const blocked = setup && !status?.canSetup;

  const switchMode = (next: Mode) => {
    setMode(next);
    setMessage(undefined);
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (mode === "register" && password !== confirm)
      return setMessage({ text: "Passwords don't match" });

    setBusy(true);
    try {
      if (mode === "login") {
        await authApi.login(username.trim(), password);
        return onSignedIn();
      }
      const { status: result } = await authApi.register(username.trim(), password);
      if (result === "active") return onSignedIn();
      switchMode("login");
      setPassword("");
      setConfirm("");
      setMessage({
        text: "Account created. You can sign in once the admin approves it.",
        ok: true,
      });
    } catch (err) {
      setMessage({ text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const subtitle = blocked
    ? "This server isn't set up yet. Ask the owner to finish setup."
    : setup
      ? "First-time setup: create the admin account."
      : "Sign in to chat.";

  return (
    <main className="auth">
      <form
        className="auth-card"
        onSubmit={submit}
        aria-label={mode === "login" ? "Sign in" : "Register"}
      >
        <div>
          <h1>Home LLM</h1>
          <p className="muted small">{subtitle}</p>
        </div>

        {!setup && (
          <div className="tabs" role="tablist">
            {(["login", "register"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => switchMode(m)}
              >
                {m === "login" ? "Sign in" : "Register"}
              </button>
            ))}
          </div>
        )}

        <fieldset disabled={blocked || busy} className="stack bare">
          <label>
            Username
            <input
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
            />
          </label>
          <label>
            Password
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={mode === "register" ? 8 : undefined}
              required
            />
          </label>
          {mode === "register" && (
            <label>
              Repeat password
              <input
                className="input"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
              />
            </label>
          )}
          <button className="btn btn-primary" type="submit">
            {mode === "login" ? "Sign in" : "Create account"}
          </button>
        </fieldset>

        {message && (
          <p role="status" className={`small ${message.ok ? "success" : "error"}`}>
            {message.text}
          </p>
        )}
      </form>
    </main>
  );
}
