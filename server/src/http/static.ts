import fs from "node:fs";
import path from "node:path";
import type { ServerResponse } from "node:http";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".woff2": "font/woff2",
};

export function createStaticHandler(webDir: string) {
  const root = path.resolve(webDir);
  const indexFile = path.join(root, "index.html");

  return (pathname: string, res: ServerResponse) => {
    const requested = path.resolve(root, "." + decodeURIComponent(pathname));
    const insideRoot = requested.startsWith(root + path.sep);
    const isFile = insideRoot && fs.statSync(requested, { throwIfNoEntry: false })?.isFile();
    const file = isFile ? requested : indexFile;

    if (!fs.existsSync(file)) {
      res.writeHead(503, { "content-type": "text/plain" });
      return res.end("Frontend not built. Run: npm run build");
    }

    const immutable = isFile && pathname.startsWith("/assets/");
    res.writeHead(200, {
      "content-type": MIME[path.extname(file)] ?? "application/octet-stream",
      "cache-control": immutable ? "public, max-age=31536000, immutable" : "no-cache",
    });
    fs.createReadStream(file).pipe(res);
  };
}
