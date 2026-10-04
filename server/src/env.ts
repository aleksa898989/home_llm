import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");

export interface Env {
  port: number;
  dataDir: string;
  ollamaUrl: string;
  webDir: string;
}

export const loadEnv = (env = process.env): Env => ({
  port: Number(env.PORT ?? 3000),
  dataDir: path.resolve(env.DATA_DIR ?? path.join(root, "data")),
  ollamaUrl: env.OLLAMA_URL ?? "http://127.0.0.1:11434",
  webDir: path.resolve(env.WEB_DIR ?? path.join(root, "dist/web")),
});
