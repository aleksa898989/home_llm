import { HttpError } from "../errors.ts";

interface Options {
  max: number;
  windowMs: number;
  now?: () => number;
}

export function createRateLimiter({ max, windowMs, now = Date.now }: Options) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  const prune = () => {
    const t = now();
    for (const [key, entry] of hits) if (entry.resetAt <= t) hits.delete(key);
  };

  return {
    check(key: string) {
      const entry = hits.get(key);
      if (entry && entry.resetAt > now() && entry.count >= max) {
        const minutes = Math.ceil((entry.resetAt - now()) / 60_000);
        throw new HttpError(429, `Too many attempts. Try again in ${minutes} min.`);
      }
    },
    hit(key: string) {
      if (hits.size > 10_000) prune();
      const entry = hits.get(key);
      if (!entry || entry.resetAt <= now()) hits.set(key, { count: 1, resetAt: now() + windowMs });
      else entry.count++;
    },
    reset: (key: string) => void hits.delete(key),
  };
}

export type RateLimiter = ReturnType<typeof createRateLimiter>;
