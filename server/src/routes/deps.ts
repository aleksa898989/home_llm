import type { RateLimiter } from "../auth/rate-limit.ts";
import type { OllamaClient } from "../ollama.ts";
import type { Services } from "../services.ts";

export interface RouteDeps extends Services {
  ollama: OllamaClient;
  limiters: { login: RateLimiter; register: RateLimiter };
  log: (message: string) => void;
}

export const SESSION_COOKIE = "hl_session";
