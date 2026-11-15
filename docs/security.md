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

## Notes on LAN / Tailscale Hosting

`pagedex` has no built-in user authentication. Bind to `127.0.0.1` (default) for local-only use, or use `--host 0.0.0.0` only on trusted private networks / Tailscale.
