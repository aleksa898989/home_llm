import path from "node:path";
import { createApp } from "./app.ts";
import { openDatabase } from "./db.ts";
import { loadEnv } from "./env.ts";
import { createOllamaClient } from "./ollama.ts";
import { createServices } from "./services.ts";

const env = loadEnv();
const services = createServices(openDatabase(path.join(env.dataDir, "home_llm.db")));
const server = createApp({
  services,
  ollama: createOllamaClient(env.ollamaUrl),
  webDir: env.webDir,
});

setInterval(() => services.sessions.purgeExpired(), 3_600_000).unref();

server.listen(env.port, () => {
  console.log(`home_llm → http://localhost:${env.port}  (ollama: ${env.ollamaUrl})`);
  if (services.users.count() === 0)
    console.log(
      `No accounts yet. Open http://localhost:${env.port} on this machine to create the admin.`,
    );
});

for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => server.close(() => process.exit(0)));
