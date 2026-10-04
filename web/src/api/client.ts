import type { ApiError as ApiErrorBody } from "../../../shared/api.ts";

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

let onUnauthorized: () => void = () => {};
export const setUnauthorizedHandler = (handler: () => void) => {
  onUnauthorized = handler;
};

export async function request(
  method: Method,
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<Response> {
  const res = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: "same-origin",
    signal,
  });
  if (res.ok) return res;

  const { error } = (await res.json().catch(() => ({ error: res.statusText }))) as ApiErrorBody;
  if (res.status === 401 && !path.startsWith("/api/auth/")) onUnauthorized();
  throw new ApiError(res.status, error || `Request failed (${res.status})`);
}

export async function requestJson<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const res = await request(method, path, body);
  return (await res.json()) as T;
}

export async function* readNdjson<T>(res: Response): AsyncGenerator<T> {
  if (!res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) if (line.trim()) yield JSON.parse(line) as T;
  }
  if (buffer.trim()) yield JSON.parse(buffer) as T;
}
