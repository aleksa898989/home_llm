import type { ModelInfo, ModelsResponse } from "../../shared/api.ts";
import type { OllamaClient } from "./ollama.ts";
import type { SettingsRepo } from "./repos/settings.ts";

export async function availableModels(
  ollama: OllamaClient,
  settings: SettingsRepo,
): Promise<ModelsResponse> {
  const installed = await ollama.listModels();
  const { enabled, default: preferred } = settings.modelConfig();
  const models: ModelInfo[] = enabled.length
    ? installed.filter((m) => enabled.includes(m.name))
    : installed;
  const fallback = models[0]?.name ?? null;
  return {
    models,
    default: models.some((m) => m.name === preferred) ? preferred : fallback,
  };
}
