# MCP Server Guide (`docs/MCP.md`)

`pagedex` includes a built-in **Model Context Protocol (MCP)** server at `/mcp` supporting three protocol eras simultaneously:
- **`2026-07-28`** (`server/discover` + Streamable HTTP)
- **`2025-11-25`** (legacy Streamable HTTP `initialize`)
- **`2024-11-05`** (legacy HTTP+SSE)

## Access Control & CLI Flags

| Flag | Env Var | Default | Behavior |
|---|---|---|---|
| `--mcp <mode>` | `PAGEDEX_MCP_MODE` | `full` | Controls which MCP tools are exposed (`read`, `write`, `full`, or `off`) |
| `--mcp-git` | `PAGEDEX_MCP_GIT` | `false` | Opt-in flag to expose `git_commit` and `git_discard` (requires `write` or `full`) |
| `--mcp-token-file <path>` | `PAGEDEX_MCP_TOKEN_FILE` | — | File containing comma/newline-separated Bearer tokens required in `Authorization: Bearer <token>` on `/mcp` (supports key rotation; empty file fails closed) |
| — | `PAGEDEX_MCP_TOKEN` | — | Optional env fallback if `--mcp-token-file` is not set |
| `--read-only` | `PAGEDEX_READ_ONLY` | `false` | Blocks all REST mutations (`403`) and forces MCP to `read` mode (unless `off`) |

### MCP Modes

| Mode | Read Tools | Write / Move Tools | `delete_note` | `git_commit` / `git_discard` |
|---|---|---|---|---|
| `read` | Yes | No | No | No |
| `write` | Yes | Yes | No | Only with `--mcp-git` |
| `full` *(default)* | Yes | Yes | Yes | Only with `--mcp-git` |
| `off` | Disabled (`404` on `/mcp`) | No | No | No |

### Examples

```bash
# Safe read-only MCP for browsing/searching notes
pagedex ~/vault --mcp read

# Allow AI agents to create/edit/move notes, but forbid deletions
pagedex ~/vault --mcp write

# Expose on LAN with Bearer token stored in a 0600 file (not in ps/shell history)
pagedex ~/vault --host 0.0.0.0 --mcp write --mcp-token-file ~/.config/pagedex/mcp-token

# Allow local git commit/discard via MCP (never pushes)
pagedex ~/vault --mcp write --mcp-git

# Lock down both Web UI/REST and MCP completely
pagedex ~/vault --read-only
```

## Client Configuration

Without token auth:

```json
{
  "mcpServers": {
    "pagedex": {
      "url": "http://127.0.0.1:4321/mcp"
    }
  }
}
```

With `--mcp-token-file`:

```json
{
  "mcpServers": {
    "pagedex": {
      "url": "http://127.0.0.1:4321/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN_HERE"
      }
    }
  }
}
```

## Exposed Tools

### Read Tools (`read`, `write`, `full`)

| Tool | Inputs | Purpose |
|---|---|---|
| `list_vault` | `{ folder? }` | List immediate subfolders and files in `/` or a subfolder |
| `read_note` | `{ path }` | Read a file's contents and incoming backlinks |
| `search_vault` | `{ query, limit? }` | Run SQLite FTS5 trigram full-text search across filenames & contents |
| `get_vault_info` | `{ recentLimit? }` | Get total file count and most recently modified files |
| `get_note_links` | `{ path }` | Get outgoing `[[wikilinks]]`, incoming backlinks, and Markdown headings |
| `git_status` | `{}` | List uncommitted modified, added, or untracked files |
| `git_diff` | `{ path }` | Get unified git diff for a specific file |

### Write Tools (`write`, `full`)

| Tool | Inputs | Purpose |
|---|---|---|
| `write_note` | `{ path, content?, append?, target?, replacement?, replaceAll? }` | Create, overwrite, append, or patch (`target` → `replacement`) a file |
| `move_path` | `{ oldPath, newPath, type? }` | Rename or move a file or directory (`type`: `auto` \| `file` \| `dir`) |

### Destructive Tool (`full` only)

| Tool | Inputs | Purpose |
|---|---|---|
| `delete_note` | `{ path }` | Delete a file from disk and remove it from the search index |

### Git Mutation Tools (`--mcp-git` with `write` or `full`)

| Tool | Inputs | Purpose |
|---|---|---|
| `git_commit` | `{ message, files? }` | Stage and commit changes locally (never pushes) |
| `git_discard` | `{ path }` | Discard uncommitted changes to a file (or delete an untracked file) |
