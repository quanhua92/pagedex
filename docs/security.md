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
- **Global login rate limit:** `POST /api/v1/auth/login` tracks failed attempts globally (default: 5 failures within 60s → 60s `429 Too Many Requests` cooldown with `Retry-After`; override via `PAGEDEX_AUTH_MAX_ATTEMPTS`, `PAGEDEX_AUTH_WINDOW_MS`, `PAGEDEX_AUTH_LOCKOUT_MS`). A successful login resets the counter.
- **REST & CLI access:** Requests to `/api/v1/*` accept either the `pagedex_auth` cookie or `Authorization: Bearer <token>`, returning `401 Unauthorized` otherwise. (`/api/v1/auth/status`, `/api/v1/auth/login`, and `/api/v1/auth/logout` remain public; an empty token file fails closed.)
- **Separate from MCP:** `/mcp` continues to be governed independently by `--mcp-token-file` (which also supports comma/newline-separated tokens for key rotation and fails closed if empty).

## Multi-Vault Config (`--config` / `PAGEDEX_ROOT_CONFIG`)

Pass `--config <path>` (or `PAGEDEX_ROOT_CONFIG`) pointing to a JSON file to serve multiple vaults on one server (auto-reloaded when edited):

```json
{
  "default": "personal",
  "vaults": {
    "personal": { "root": "~/vault", "allowGlobalAuth": true },
    "work": { "root": "~/work-notes", "authTokenFile": "~/.config/pagedex/work-auth", "allowGlobalAuth": false },
    "docs": { "root": "~/docs", "readOnly": true, "allowGlobalAuth": true }
  }
}
```

- `allowGlobalAuth`: defaults to `true` when `authTokenFile` is omitted, or `false` when `authTokenFile` is set. Set explicitly to `true`/`false` to control whether global `PAGEDEX_AUTH_TOKEN_FILE` / `PAGEDEX_MCP_TOKEN_FILE` tokens can also unlock that vault.
- Entering a token on `/api/v1/auth/login` unlocks only the vaults that accept that token; `GET /api/v1/vaults` and `POST /api/v1/vault/select` enforce per-vault authorization.

## Notes on LAN / Tailscale Hosting

Without `--auth-token-file`, `pagedex` has no user authentication. Bind to `127.0.0.1` (default) for local-only use, or pass `--auth-token-file` / `--read-only` when exposing via `--host 0.0.0.0` or Tailscale.

## Reverse Proxy & `X-Frame-Options`

PageDex renders `.html` / `.htm` previews inside `<iframe src="/raw/..." sandbox="allow-scripts">` (without `allow-same-origin` — adding `allow-same-origin` alongside `allow-scripts` on a same-origin iframe would let vault HTML escape the sandbox, access `window.parent` / cookies, and call `/api/v1/*` directly). Because of the opaque (`null`) origin, any reverse proxy or CDN in front of PageDex that injects `X-Frame-Options: DENY` or `SAMEORIGIN` will block HTML previews.

Exclude `/raw/*` from `X-Frame-Options` on your proxy:

- **Caddy:**
  ```caddy
  vault.example.com {
      header /raw/* -X-Frame-Options
      reverse_proxy 127.0.0.1:4321
  }
  ```
- **Nginx:** In a `location ^~ /raw/` block, omit `add_header X-Frame-Options` (or use `proxy_hide_header X-Frame-Options;`).
- **Cloudflare:** Exclude `/raw/*` from any Transform Rule or security header policy that sets `X-Frame-Options`.
