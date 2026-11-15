# AGENTS.md — pagedex

## Overview

`pagedex` is a standalone Node.js CLI & web server (`bin/pagedex.js` + `src/server/` + `src/client/`) that turns any local directory of Markdown files into a web viewer/editor, REST API, and multi-era MCP server on a single port (`4321` by default).

## Layout

```text
pagedex/
├── bin/
│   └── pagedex.js                  # CLI entrypoint (npx pagedex [dir] --port --host --open)
├── src/
│   ├── server/
│   │   ├── index.js                # Hono server, /api/v1, /mcp, static dist/ serving
│   │   ├── dev.js                  # Concurrent API (:4321) + Vite (:5173) dev launcher
│   │   ├── paths.js                # VAULT_ROOT (PAGEDEX_ROOT/VAULT_ROOT/cwd), IGNORED, resolveSafe
│   │   ├── vault-cache.js          # In-memory tree, fileStats, backlinks cache
│   │   ├── fs-ops.js               # Note CRUD, rename, upload
│   │   ├── git.js                  # Git status, diff, line/file discard, commit & push
│   │   ├── vault.js                # Barrel re-export
│   │   ├── search-index.js         # SQLite FTS5 trigram index (~/.cache/pagedex/<hash>.db)
│   │   ├── mcp.js                  # Multi-era MCP server (@modelcontextprotocol/server + SSE)
│   │   └── routes/
│   │       ├── files.js            # /api/v1/health, /tree, /files, /search, /file, /dir/rename
│   │       ├── git.js              # /api/v1/changes, /git/diff, /git/discard, /git/commit
│   │       └── events.js           # fs.watch + /api/v1/events (SSE)
│   └── client/
│       ├── index.html
│       ├── main.jsx
│       ├── App.jsx                 # Tabs, editor/preview/diff/raw, SSE live reload, edge swipe
│       ├── TiptapEditor.jsx        # Lazy-loaded WYSIWYG Markdown editor
│       ├── styles.css
│       ├── lib/
│       │   ├── useEdgeSwipe.js     # Live finger-tracking left/right drawer gestures
│       │   ├── settings.js
│       │   ├── paths.js
│       │   └── markdown.js
│       └── components/             # Sidebar (with long-press row actions), OutlineSidebar, modals
├── test/
│   ├── api-mcp.test.js             # Unit/integration tests (node --test)
│   └── smoke.js                    # REST + MCP v2 (2026-07-28, 2025-11-25, 2024-11-05 SSE) smoke suite
├── dist/                           # Prebuilt Vite client bundle (gitignored, published to npm)
├── package.json
└── vite.config.js
```

## Key Invariants

1. **Node `>= 22.5.0`:** Uses `node:sqlite` (`DatabaseSync`) in `src/server/search-index.js`.
2. **External FTS5 cache:** `search-index.js` writes to `~/.cache/pagedex/<sha256>.db` (or `PAGEDEX_INDEX_DIR` / `PAGEDEX_INDEX_PATH`) so `npx pagedex` never creates untracked `.db` files inside the target directory.
3. **Single-port production serving:** `vite build` outputs to `dist/`. In production / `npx`, `src/server/index.js` serves `dist/`, `/api/v1/*`, and `/mcp` on port `4321` (or `--port` / `PORT`).
4. **Multi-era MCP endpoint (`/mcp`):** Backed by `@modelcontextprotocol/server` `createMcpHandler` (2026-07-28 `server/discover` + 2025-11-25 `initialize`) plus `WebStandardSSEServerTransport` (2024-11-05 HTTP+SSE).

## Commands

```bash
pnpm install      # Install dependencies
pnpm dev          # Start server (:4321) + Vite HMR (:5173)
pnpm build        # Build dist/ (required before npm publish or running bin/pagedex.js)
pnpm test         # Run test/api-mcp.test.js
pnpm smoke        # Run REST + MCP smoke checks
```
