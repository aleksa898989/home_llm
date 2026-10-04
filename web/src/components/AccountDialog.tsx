import { useState, type FormEvent } from "react";
import { authApi } from "../api/endpoints.ts";
import { Dialog } from "./Dialog.tsx";

interface Props {
  onClose: () => void;
  onSignOut: () => void;
}

export function AccountDialog({ onClose, onSignOut }: Props) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [message, setMessage] = useState<{ text: string; ok?: boolean }>();

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    try {
      await authApi.changePassword(current, next);
      setCurrent("");
      setNext("");
      setMessage({ text: "Password changed. Other devices were signed out.", ok: true });
    } catch (err) {
      setMessage({ text: (err as Error).message });
    }
  }

  return (
    <Dialog title="Account" onClose={onClose}>
      <form className="stack" onSubmit={changePassword}>
        <input
          className="input"
          type="password"
          placeholder="Current password"
          aria-label="Current password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
        />
        <input
          className="input"
          type="password"
          placeholder="New password (8+ characters)"
          aria-label="New password"
          autoComplete="new-password"
          minLength={8}
          value={next}
          onChange={(e) => setNext(e.target.value)}
          required
        />
        <button className="btn" type="submit">
          Change password
        </button>
        {message && <p className={`small ${message.ok ? "success" : "error"}`}>{message.text}</p>}
      </form>

      <div className="dialog-footer">
        <button className="btn btn-danger" onClick={onSignOut}>
          Sign out
        </button>
        <button className="btn" onClick={onClose}>
          Close
        </button>
      </div>
    </Dialog>
  );
}
