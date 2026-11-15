# Security Model

## Sandboxed HTML Previews

When previewing `.html` / `.htm` files:

1. **Iframe isolation (`sandbox="allow-scripts"`):**
   - `allow-same-origin` is intentionally omitted.
   - The iframe runs with an opaque (`null`) origin, so scripts inside vault HTML cannot access `window.parent`, `localStorage`, cookies, or pagedex's DOM.
   - Top-level navigation, popups, and form submissions are disabled.

2. **`Origin: null` API guard (`src/server/index.js`):**
   - Mutating requests (`POST`, `PUT`, `PATCH`, `DELETE`) to `/api/v1/*` with `Origin: null` are rejected with `403 Forbidden`, preventing CORS simple-request CSRF from sandboxed iframes.

3. **Origin-scoped Content-Security-Policy (`src/server/routes/files.js`):**
   - Responses for `/raw/*.html` and `/raw/*.htm` include a `Content-Security-Policy` header scoped to the request's origin (`x-forwarded-host` / `host` / `referer`), plus `'unsafe-inline' 'unsafe-eval' data: blob:`.
   - This allows local sibling assets (`style.css`, `app.js`, `data.json`, images) while blocking outbound requests to external domains.

4. **Path Guards (`src/server/paths.js`, `src/server/routes/files.js`):**
   - All file access passes through `resolveSafe()` (prevents `..` traversal outside `VAULT_ROOT`).
   - `/raw/*` blocks protected segments (`.git`, `node_modules`, `dist`) and `.env*` files.

## Web & REST Authentication (`--auth-token-file`)

Pass `--auth-token-file <path>` (or `PAGEDEX_AUTH_TOKEN_FILE`) to lock the Web UI and all `/api/v1/*` endpoints behind token authentication:

- **Comma/newline-separated tokens:** Store one or more tokens in the file (e.g. `token1,token2`) for zero-downtime key rotation.
- **Session cookie (`POST /api/v1/auth/login`):** Validates `{ token }` (or `Authorization: Bearer <token>`) and sets an `HttpOnly; SameSite=Lax` HMAC-signed cookie (`pagedex_auth`). Removing a key from the file immediately revokes sessions signed by that key.
- **REST & CLI access:** Requests to `/api/v1/*` accept either the `pagedex_auth` cookie or `Authorization: Bearer <token>`, returning `401 Unauthorized` otherwise. (`/api/v1/auth/status`, `/api/v1/auth/login`, and `/api/v1/auth/logout` remain public; an empty token file fails closed.)
- **Separate from MCP:** `/mcp` continues to be governed independently by `--mcp-token-file`.

## Notes on LAN / Tailscale Hosting

Without `--auth-token-file`, `pagedex` has no user authentication. Bind to `127.0.0.1` (default) for local-only use, or pass `--auth-token-file` / `--read-only` when exposing via `--host 0.0.0.0` or Tailscale.
