import type { ModelConfig } from "../../../shared/api.ts";
import type { Database } from "../db.ts";

export function createSettingsRepo(db: Database) {
  const read = <T>(key: string, fallback: T): T => {
    const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as
      { value: string } | undefined;
    return row ? (JSON.parse(row.value) as T) : fallback;
  };

  const write = (key: string, value: unknown) =>
    db
      .prepare(
        "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      )
      .run(key, JSON.stringify(value));

  return {
    modelConfig: () => read<ModelConfig>("models", { enabled: [], default: null }),
    saveModelConfig: (config: ModelConfig) => void write("models", config),
  };
}

export type SettingsRepo = ReturnType<typeof createSettingsRepo>;
