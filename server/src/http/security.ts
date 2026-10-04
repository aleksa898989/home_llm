import type { IncomingMessage, ServerResponse } from "node:http";
import { HttpError } from "../errors.ts";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

export function setSecurityHeaders(res: ServerResponse) {
  res.setHeader("content-security-policy", CSP);
  res.setHeader("x-content-type-options", "nosniff");
  res.setHeader("x-frame-options", "DENY");
  res.setHeader("referrer-policy", "no-referrer");
  res.setHeader("permissions-policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("cross-origin-opener-policy", "same-origin");
}

/**
 * CSRF guard. A cross-site page can only send "simple" requests without a CORS
 * preflight (which we never grant): GET/HEAD/POST with form-like content types.
 * So POST must be JSON, and any Origin the browser sends must match our host.
 */
export function assertSameOrigin(req: IncomingMessage) {
  const method = req.method ?? "GET";
  if (SAFE_METHODS.has(method)) return;
  if (method === "POST" && !req.headers["content-type"]?.startsWith("application/json"))
    throw new HttpError(415, "Expected application/json");

  const origin = req.headers.origin;
  if (!origin) return;
  const host = req.headers["x-forwarded-host"] ?? req.headers.host;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new HttpError(403, "Bad origin");
  }
  if (originHost !== host) throw new HttpError(403, "Cross-origin request blocked");
}
