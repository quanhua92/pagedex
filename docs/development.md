# Development & Release

## Running in Development

Start both the Hono API/MCP/Raw server (`:4321`) and Vite HMR dev server (`:5173`):

```bash
pnpm install
PAGEDEX_ROOT=~/vault HOST=0.0.0.0 pnpm dev
```

- **Dev UI:** `http://<host>:5173` (Vite proxies `/api/v1`, `/raw`, and `/mcp` with `xfwd: true` to `127.0.0.1:4321`)
- **API / Production UI:** `http://<host>:4321`

## Build & Test

```bash
pnpm build   # Build production React bundle into dist/
pnpm test    # Run node:test suite (test/api-mcp.test.js)
pnpm smoke   # Run REST + multi-era MCP smoke checks against :4321
```

## npm Package Contents

`package.json` restricts the published tarball via `"files"` and runs `prepublishOnly: "vite build"`:

- **Included:** `package.json`, `README.md`, `bin/pagedex.js`, `src/server/**`, and compiled `dist/**`.
- **Excluded:** `src/client/**`, `docs/`, `.agents/`, `test/`, `vite.config.js`, `.github/`.

Verify exact tarball contents before publishing with:

```bash
npm pack --dry-run
```
