import { useState, type FormEvent } from "react";
import type { ModelConfig, ModelInfo, PullProgress } from "../../../shared/api.ts";
import { adminApi } from "../api/endpoints.ts";
import { formatBytes } from "../format.ts";

interface Props {
  installed: ModelInfo[];
  config: ModelConfig;
  onChanged: () => void;
}

export function ModelSettings({ installed, config, onChanged }: Props) {
  const [pullName, setPullName] = useState("");
  const [progress, setProgress] = useState<PullProgress>();
  const [pulling, setPulling] = useState(false);
  const [error, setError] = useState<string>();

  const enabled = new Set(config.enabled.length ? config.enabled : installed.map((m) => m.name));

  const save = async (next: ModelConfig) => {
    await adminApi.saveConfig(next);
    onChanged();
  };

  const toggle = (name: string) => {
    const set = new Set(enabled);
    if (set.has(name)) set.delete(name);
    else set.add(name);
    void save({ ...config, enabled: installed.map((m) => m.name).filter((n) => set.has(n)) });
  };

  const remove = async (name: string) => {
    if (!confirm(`Delete ${name} from disk?`)) return;
    await adminApi.deleteModel(name);
    onChanged();
  };

  async function pull(e: FormEvent) {
    e.preventDefault();
    const name = pullName.trim();
    if (!name) return;
    setPulling(true);
    setError(undefined);
    try {
      for await (const p of adminApi.pullModel(name)) {
        if (p.error) throw new Error(p.error);
        setProgress(p);
      }
      setPullName("");
      setProgress(undefined);
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPulling(false);
    }
  }

  return (
    <section aria-labelledby="models-heading">
      <h3 id="models-heading">Models</h3>
      <p className="muted small">Checked models are visible to everyone. ★ marks the default.</p>

      {installed.length === 0 && (
        <p className="muted small">No models installed yet. Pull one below.</p>
      )}
      {installed.map((m) => (
        <div className="row" key={m.name}>
          <input
            type="checkbox"
            aria-label={`Enable ${m.name}`}
            checked={enabled.has(m.name)}
            onChange={() => toggle(m.name)}
          />
          <span className="row-main">
            {m.name}{" "}
            <small className="muted">
              {[m.params, m.quant, formatBytes(m.size)].filter(Boolean).join(" · ")}
            </small>
          </span>
          <button
            className="btn btn-ghost"
            aria-label={`Make ${m.name} the default`}
            aria-pressed={config.default === m.name}
            onClick={() => void save({ ...config, default: m.name })}
          >
            {config.default === m.name ? "★" : "☆"}
          </button>
          <button
            className="btn btn-ghost"
            aria-label={`Delete ${m.name}`}
            onClick={() => void remove(m.name)}
          >
            🗑
          </button>
        </div>
      ))}

      <form className="inline-form" onSubmit={pull}>
        <input
          className="input"
          placeholder="Pull a model, e.g. llama3.2:3b"
          aria-label="Model to pull"
          value={pullName}
          onChange={(e) => setPullName(e.target.value)}
          disabled={pulling}
        />
        <button className="btn" type="submit" disabled={pulling || !pullName.trim()}>
          {pulling ? "Pulling…" : "Pull"}
        </button>
      </form>
      {progress && (
        <div className="small muted">
          {progress.status}
          {progress.total
            ? ` — ${formatBytes(progress.completed ?? 0)} / ${formatBytes(progress.total)}`
            : ""}
          {progress.total ? (
            <progress value={progress.completed ?? 0} max={progress.total} />
          ) : null}
        </div>
      )}
      {error && <p className="error small">{error}</p>}
    </section>
  );
}
