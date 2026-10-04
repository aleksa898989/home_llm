import type { IncomingMessage, ServerResponse } from "node:http";
import { isHttps } from "./request.ts";

export function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

export function setCookie(
  req: IncomingMessage,
  res: ServerResponse,
  name: string,
  value: string,
  maxAgeSeconds: number,
) {
  const attributes = ["Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${maxAgeSeconds}`];
  if (isHttps(req)) attributes.push("Secure");
  res.setHeader("set-cookie", `${name}=${value}; ${attributes.join("; ")}`);
}

export async function proxyStream(
  res: ServerResponse,
  start: (signal: AbortSignal) => Promise<Response>,
) {
  const controller = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) controller.abort();
  });

  try {
    const upstream = await start(controller.signal);
    res.writeHead(upstream.status, {
      "content-type": "application/x-ndjson",
      "cache-control": "no-cache",
    });
    if (upstream.body) for await (const chunk of upstream.body) res.write(chunk);
    res.end();
  } catch (e) {
    if ((e as Error).name === "AbortError") return;
    if (!res.headersSent) throw e;
    res.end(JSON.stringify({ error: (e as Error).message }) + "\n");
  }
}
