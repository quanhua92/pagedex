# Getting Started

`pagedex` turns any local folder of notes, code, media, and HTML into a fast web catalog with full-text search, backlinks, Git sync, and an MCP server on a single port.

## Requirements

- **Node.js `>= 22.5.0`** (uses built-in `node:sqlite` for FTS5 trigram search)

## Running with `npx`

```bash
# Serve the current directory on http://127.0.0.1:4321
npx pagedex

# Serve a specific folder and open it in your browser
npx pagedex ~/vault --open

# Expose on your LAN / Tailscale IP
npx pagedex ~/vault --host 0.0.0.0 --port 4321
```

### CLI Options

| Flag | Env Var | Default | Description |
|---|---|---|---|
| `[dir]` | `PAGEDEX_ROOT` / `VAULT_ROOT` | `process.cwd()` | Root directory to serve |
| `-p, --port <port>` | `PORT` | `4321` | HTTP port |
| `-H, --host <host>` | `HOST` | `127.0.0.1` | Bind address (`0.0.0.0` for LAN/Tailscale) |
| `-o, --open` | — | `false` | Open browser on startup |
| `-v, --version` | — | — | Print version |
| `-h, --help` | — | — | Print CLI help |

### Search Index Cache

The SQLite FTS5 trigram index is stored **outside** your target folder at `~/.cache/pagedex/<sha256>.db`, so running `pagedex` never creates untracked files in your Git repository.

Override the cache location with:
- `PAGEDEX_INDEX_DIR` — directory for `<hash>.db` files
- `PAGEDEX_INDEX_PATH` — exact `.db` file path

## Web UI Highlights

- **View Modes (top-right `⋮` menu):**
  - **Download** — downloads any open file via `/api/v1/file?path=...&download=1`
  - **Preview** — rendered Markdown, sandboxed HTML, PDF, audio/video, CSV/TSV tables, or images
  - **Edit** — lazy-loaded Tiptap WYSIWYG editor for Markdown (`.md`, `.markdown`, `.mdx`)
  - **Diff** — line-by-line Git diff with per-line, per-hunk, and per-file discard
  - **Raw** — syntax-highlighted source (including SVG XML, HTML, CSV, and code)
- **Wikilinks & Backlinks:** `[[note]]` and relative links resolve across the folder, and the outline panel lists incoming backlinks.
- **Git Integration:** Browse changed files in the Changes tab, inspect hunks, discard changes, or commit & push directly from the UI.
- **Live Reload (SSE):** External edits on disk (e.g. from your editor or an AI agent via MCP) refresh open files and the sidebar tree automatically via `/api/v1/events`.
- **Mobile Friendly:** Edge-swipe gestures open the left file drawer and right outline drawer, with long-press context actions in the tree.
