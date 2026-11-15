# MCP & REST API

`pagedex` exposes both a multi-era **Model Context Protocol (MCP)** server and a **REST API** on the same port (`4321` by default).

## MCP Server (`/mcp`)

The `/mcp` endpoint supports three MCP protocol eras simultaneously:
- **`2026-07-28`** (`server/discover` + Streamable HTTP)
- **`2025-11-25`** (legacy Streamable HTTP `initialize`)
- **`2024-11-05`** (legacy HTTP+SSE)

### Example Client Config

Point any HTTP-capable MCP client (Claude Code, Cursor, VS Code, etc.) at:

```json
{
  "mcpServers": {
    "pagedex": {
      "url": "http://127.0.0.1:4321/mcp"
    }
  }
}
```

### Exposed MCP Tools

| Tool | Purpose |
|---|---|
| `list_vault` | List files/folders and metadata in the served root |
| `read_note` | Read file contents and backlinks |
| `search_vault` | Run SQLite FTS5 trigram full-text search |
| `write_note` | Create, overwrite, append, or patch (`target` → `replacement`) files |
| `delete_note` | Delete a file from disk and update the search index |

## REST API (`/api/v1/*`)

| Method & Path | Description |
|---|---|
| `GET /api/v1/health` | Health check and resolved `root` path |
| `GET /api/v1/tree` | Full directory tree, `flatFiles`, `fileStats`, `backlinks` (`?sort=mtime\|name`, `?limit=`) |
| `GET /api/v1/files` | Paginated file listing (`?sort=`, `?offset=`, `?limit=`, `?q=`) |
| `GET /api/v1/search` | Full-text search (`?q=`, `?limit=`) |
| `GET /api/v1/file` | Read/stream a file (`?path=`, optional `?download=1`, supports HTTP `Range`) |
| `PUT / POST / PATCH /api/v1/file` | Create, append (`append: true`), or partial-edit (`target`, `replacement`) |
| `DELETE /api/v1/file` | Delete file (`?path=`) |
| `POST /api/v1/file/upload` | Multipart file upload into a target folder |
| `POST /api/v1/file/rename` | Rename/move a file |
| `POST /api/v1/dir/rename` | Rename/move a directory |
| `GET /api/v1/changes` | Git working-tree changes |
| `GET /api/v1/git/diff` | Parsed diff hunks for a file (`?path=`) |
| `POST /api/v1/git/discard` | Discard line, hunk, or entire file changes |
| `POST /api/v1/git/commit` | Commit selected files (and optional push) |
| `GET /api/v1/events` | Server-Sent Events stream for live filesystem changes |

## Static / Raw Route (`/raw/*`)

`GET /raw/<relPath>` serves files by URL path rather than query string so HTML previews can load sibling assets (`style.css`, `app.js`, `data.json`) with relative URLs. See [Security Model](./security.md) for isolation details.
