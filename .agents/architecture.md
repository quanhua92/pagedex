# Architecture & Invariants

## Runtime Topology

- **Production / `npx pagedex`:** `bin/pagedex.js` parses CLI flags (`[dir]`, `-p/--port`, `-H/--host`, `-o/--open`) into env vars and starts `src/server/index.js` on a single port (`4321` by default).
- **Development (`pnpm dev`):** `src/server/dev.js` spawns `node --watch src/server/index.js` (`:4321`) and `vite` (`:5173`). `vite.config.js` proxies `/api/v1`, `/raw`, and `/mcp` with `xfwd: true` to `127.0.0.1:4321`.

## Server Surface (`src/server/`)

- `GET /api/v1/health`, `/tree` (supports `?refresh=1`), `/files`, `/search`, `/file` (supports `?download=1` and HTTP `Range`), `PUT/POST/PATCH/DELETE /api/v1/file`, `POST /api/v1/file/upload`, `POST /api/v1/file/rename`, `POST/DELETE /api/v1/dir`, `POST /api/v1/dir/rename` (`src/server/routes/files.js`)
- `GET /raw/*` (`src/server/routes/files.js`): path-based static/raw serving for sandboxed HTML previews and sibling assets (`style.css`, `app.js`, `data.json`). Sends `Access-Control-Allow-Origin: *`, supports HTTP `Range`, and attaches an origin-scoped `Content-Security-Policy` on `.html`/`.htm`.
- `GET /api/v1/changes`, `/git/diff`, `POST /api/v1/git/discard`, `/git/commit` (`src/server/routes/git.js`)
- `GET /api/v1/events` (`src/server/routes/events.js`): `fs.watch` SSE stream for live tree/file reloads.
- `ALL /mcp` (`src/server/mcp.js`): Multi-era MCP endpoint (`2026-07-28` `server/discover`, `2025-11-25` Streamable HTTP, `2024-11-05` HTTP+SSE).

## Security Invariants

1. `src/server/index.js` rejects `POST`/`PUT`/`PATCH`/`DELETE` on `/api/v1/*` when `Origin === 'null'` (`403 Forbidden`).
2. `resolveSafe()` (`src/server/paths.js`) blocks `..` traversal outside `VAULT_ROOT`.
3. `/raw/*` rejects `isProtectedPath()` (`.git`, `node_modules`, `dist`) and `.env*` basenames (`404`).
4. HTML previews in `src/client/components/NoteViewer.jsx` use `<iframe src="/raw/..." sandbox="allow-scripts" />` without `allow-same-origin`.

## Client File-Type Routing (`src/client/`)

- `src/client/lib/paths.js` defines predicates: `isMarkdownPath`, `isImagePath`, `isSvgPath`, `isPdfPath`, `isAudioPath`, `isVideoPath`, `isHtmlPath`, `isCsvPath`, `isNotebookPath`, `isDownloadOnlyPath`.
- `src/client/App.jsx` (`openFile`) skips `res.text()` for non-SVG images, PDFs, audio, video, and download-only binaries (using `HEAD` instead).
- `src/client/components/NoteViewer.jsx` renders per-type views (including `NotebookViewer.jsx` via `@jupyter-kit/react` for `.ipynb`); `src/client/components/TopbarAndTabs.jsx` exposes `Download` above `Preview` in the top-right options menu.

## External Search Index

`src/server/search-index.js` uses Node's built-in `node:sqlite` (`DatabaseSync`, requires Node `>= 22.5.0`) and stores FTS5 trigram indexes at `~/.cache/pagedex/<sha256>.db` (or `PAGEDEX_INDEX_DIR` / `PAGEDEX_INDEX_PATH`) so target folders remain clean.
