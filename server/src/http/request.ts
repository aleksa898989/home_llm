import type { IncomingMessage } from "node:http";
import { HttpError } from "../errors.ts";

const MAX_BODY_BYTES = 5_000_000;

export async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, "Body too large");
    chunks.push(chunk);
  }
  if (!size) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "Invalid JSON");
  }
}

export function getCookie(req: IncomingMessage, name: string): string | undefined {
  for (const part of req.headers.cookie?.split(";") ?? []) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
}

const header = (req: IncomingMessage, name: string) => {
  const value = req.headers[name];
  return Array.isArray(value) ? value.join(",") : value;
};

/** The proxy (ngrok) appends the real client IP, so the last entry is the one we can trust. */
export function clientIp(req: IncomingMessage): string {
  const forwarded = header(req, "x-forwarded-for")
    ?.split(",")
    .map((ip) => ip.trim())
    .filter(Boolean);
  return forwarded?.at(-1) ?? req.socket.remoteAddress ?? "unknown";
}

export const isProxied = (req: IncomingMessage) =>
  ["x-forwarded-for", "x-forwarded-host", "forwarded"].some((h) => h in req.headers);

export const isHttps = (req: IncomingMessage) => header(req, "x-forwarded-proto") === "https";
