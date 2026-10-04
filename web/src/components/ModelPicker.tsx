import type { ModelInfo } from "../../../shared/api.ts";

interface Props {
  models: ModelInfo[];
  value: string;
  onChange: (name: string) => void;
  error?: string;
}

export function ModelPicker({ models, value, onChange, error }: Props) {
  if (error) return <span className="error small">{error}</span>;
  return (
    <select
      className="input input-auto"
      aria-label="Model"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {models.length === 0 && <option value="">No models available</option>}
      {models.map((m) => (
        <option key={m.name} value={m.name}>
          {m.name}
          {m.params ? ` · ${m.params}` : ""}
        </option>
      ))}
    </select>
  );
}
