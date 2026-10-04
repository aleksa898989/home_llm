# Home LLM

A small, self-hosted, multi-user chat UI for local LLMs running in [Ollama](https://ollama.com). Built for a household: one Mac runs the models, everyone else chats from their phone or laptop through a private link.

- Accounts with admin approval: anyone can register, nobody gets in until an admin approves them
- Admins choose which models are visible, set the default, and pull or delete models from the UI
- Streaming replies with Markdown, code blocks, tables and collapsible "thinking"
- Chat history stored per user on the server
- Single Node process, SQLite database, no external services besides Ollama (and ngrok for remote access)

## Architecture

```
browser ──https──▶ ngrok ──▶ app (Docker) ──▶ Ollama (native, Metal GPU)
                               │
                               └── SQLite: users, sessions, chats, settings
```

Ollama runs natively rather than in Docker because Docker on macOS has no GPU access.

| Path      | What                                                                                 |
| --------- | ------------------------------------------------------------------------------------ |
| `server/` | Node HTTP server in TypeScript (run directly via Node type stripping, no build step) |
| `web/`    | React + Vite frontend, built to `dist/web` and served by the server                  |
| `shared/` | API types shared by server and frontend                                              |

Server modules:

- `app.ts` wires the routes together.
- `routes/` holds the endpoints.
- `repos/` holds the SQLite data access.
- `auth/` covers password hashing, sessions and rate limiting.
- `http/` has the router, request/response helpers, security and static files.

Everything is created through factories and passed in explicitly, so tests can run the real app against an in-memory database and a fake Ollama.

## Running it

Requirements: macOS with [Ollama](https://ollama.com/download) and Docker Desktop.

1. Configure Ollama for a 16 GB machine (one model in memory at a time), then restart the Ollama app:
   ```bash
   launchctl setenv OLLAMA_MAX_LOADED_MODELS 1
   launchctl setenv OLLAMA_NUM_PARALLEL 2
   ```
2. Copy `.env.example` to `.env` and add your [ngrok authtoken](https://dashboard.ngrok.com/get-started/your-authtoken) and [free static domain](https://dashboard.ngrok.com/domains).
3. Start:
   ```bash
   docker compose up -d --build
   ```
4. On the same Mac, open http://localhost:3000 and create the admin account. The first account can only be created locally, never through the tunnel.
5. Share `https://<your-domain>` with the household and approve people under ⚙ → People.

Model suggestions for an M1 Pro / 16 GB: `qwen3:8b`, `gemma3:12b`, `llama3.1:8b`. For quick tests: `gemma3:270m`.

### Admin CLI

```bash
docker compose exec app admin list
docker compose exec app admin create <username>          # new admin with a random password
docker compose exec app admin reset-password <username>
docker compose exec app admin make-admin <username>
```

### Backups

All state lives in `data/home_llm.db`. Back up that file. It contains password hashes and everyone's chats, so keep it private.

## Development

Requires Node 22.13+ (see `.nvmrc`) and Ollama running locally.

```bash
npm install
npm run dev        # API on :3000 (auto-reload) + Vite on :5173 (proxying /api)
```

Open http://localhost:5173 and register the first account.

| Script              | Purpose                               |
| ------------------- | ------------------------------------- |
| `npm test`          | Server and frontend tests (Vitest)    |
| `npm run typecheck` | TypeScript for server and web         |
| `npm run lint`      | ESLint                                |
| `npm run format`    | Prettier                              |
| `npm run check`     | Everything CI runs                    |
| `npm run build`     | Build the frontend to `dist/web`      |
| `npm start`         | Production server (serves `dist/web`) |

Environment variables: `PORT` (3000), `DATA_DIR` (`./data`), `OLLAMA_URL` (`http://127.0.0.1:11434`), `WEB_DIR` (`./dist/web`).

To use Ollama on another machine, set `OLLAMA_URL=http://<that-machine>:11434`. On that machine, run `launchctl setenv OLLAMA_HOST 0.0.0.0` and restart Ollama.

## Security

- **Accounts:** passwords are hashed with scrypt (random salt, constant-time comparison). Login responses don't reveal whether a username exists.
- **Sessions:** a 256-bit random token in an `HttpOnly`, `SameSite=Lax` cookie (`Secure` behind HTTPS). Only its SHA-256 is stored. Sessions expire after 30 days, and they are revoked on logout, password change, block or password reset.
- **Access:** new accounts are pending until an admin approves them. The first (admin) account can only be created from the host itself. Admins can't demote or delete themselves.
- **Brute force:** login and registration are rate-limited per client IP. Behind the proxy, only the IP that ngrok appends is trusted, so a client can't spoof the header to get around the limit.
- **CSRF:** state-changing requests must be same-origin, and POSTs must be JSON.
- **XSS:** Markdown is rendered with `react-markdown` without raw HTML, and there's a strict CSP (`script-src 'self'`, no inline scripts, no third-party origins). The frontend has a test that model output containing `<script>` or `<img onerror>` is never rendered.
- **Data isolation:** chats are scoped to their owner in every query.
- **Input validation:** every request body and parameter is validated with zod.
- **Container:** non-root user, read-only filesystem, all capabilities dropped, `no-new-privileges`. Ports are bound to `127.0.0.1` only, so the app is reachable from outside solely through the tunnel.
