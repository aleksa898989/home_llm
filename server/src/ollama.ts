import type { ModelInfo } from "../../shared/api.ts";

export interface OllamaChatRequest {
  model: string;
  messages: { role: string; content: string }[];
  think?: boolean;
}

export interface OllamaClient {
  listModels(): Promise<ModelInfo[]>;
  chat(request: OllamaChatRequest, signal: AbortSignal): Promise<Response>;
  pull(model: string, signal: AbortSignal): Promise<Response>;
  remove(model: string): Promise<boolean>;
}

interface TagsResponse {
  models: {
    name: string;
    size: number;
    details?: { parameter_size?: string; quantization_level?: string };
  }[];
}

export function createOllamaClient(baseUrl: string): OllamaClient {
  const request = (endpoint: string, method: string, body?: unknown, signal?: AbortSignal) =>
    fetch(new URL(endpoint, baseUrl), {
      method,
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });

  return {
    async listModels() {
      const res = await request("/api/tags", "GET");
      if (!res.ok) throw new Error(`Ollama responded ${res.status}`);
      const { models } = (await res.json()) as TagsResponse;
      return models.map((m) => ({
        name: m.name,
        size: m.size,
        params: m.details?.parameter_size,
        quant: m.details?.quantization_level,
      }));
    },

    chat: (body, signal) =>
      request("/api/chat", "POST", { ...body, stream: true, keep_alive: "30m" }, signal),

    pull: (model, signal) => request("/api/pull", "POST", { model, stream: true }, signal),

    async remove(model) {
      const res = await request("/api/delete", "DELETE", { model });
      return res.ok;
    },
  };
}
