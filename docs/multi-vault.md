# Multi-Vault Guide

Serve multiple local folders (`personal`, `work`, `docs`, etc.) from a single `pagedex` process and port using `--config <path>` (or `PAGEDEX_ROOT_CONFIG`).

When `--config` / `PAGEDEX_ROOT_CONFIG` is **not** set, `pagedex` runs in single-vault mode using `[dir]` / `PAGEDEX_ROOT` with full backward compatibility.

## Quick Start

1. Create `~/.config/pagedex/vaults.json`:

   ```json
   {
     "default": "personal",
     "vaults": {
       "personal": {
         "root": "~/vault",
         "allowGlobalAuth": true
       },
       "work": {
         "root": "~/work-notes",
         "authTokenFile": "~/.config/pagedex/work-auth",
         "mcpTokenFile": "~/.config/pagedex/work-mcp",
         "allowGlobalAuth": false
       },
       "docs": {
         "root": "~/projects/docs",
         "readOnly": true,
         "allowGlobalAuth": true
       }
     }
   }
   ```

2. Start `pagedex`:

   ```bash
   npx pagedex --host 0.0.0.0 --config ~/.config/pagedex/vaults.json --auth-token-file ~/.config/pagedex/global-auth
   ```

   Or with environment variables:

   ```bash
   PAGEDEX_ROOT_CONFIG=~/.config/pagedex/vaults.json PAGEDEX_AUTH_TOKEN_FILE=~/.config/pagedex/global-auth npx pagedex --host 0.0.0.0
   ```

## Config Schema

| Field | Type | Default | Description |
|---|---|---|---|
| `default` | `string` | First key in `vaults` | Default vault ID when no vault cookie/header/query is present |
| `vaults.<id>.root` | `string` | *(required)* | Directory path for the vault (supports `~` expansion) |
| `vaults.<id>.authTokenFile` | `string` | `""` | Per-vault token file for Web & REST auth (comma/newline-separated) |
| `vaults.<id>.allowGlobalAuth` | `boolean` | `true` if `authTokenFile` is omitted, `false` if set | Whether global `PAGEDEX_AUTH_TOKEN_FILE` / `PAGEDEX_MCP_TOKEN_FILE` tokens also unlock this vault |
| `vaults.<id>.mcpTokenFile` | `string` | `""` | Per-vault Bearer token file for `/mcp` |
| `vaults.<id>.readOnly` | `boolean` | `false` | Disables REST & MCP write/delete/git mutations for this vault |

## Authentication & `allowGlobalAuth`

- **Explicit login selection:** When multiple vaults are configured, the login screen shows a vault dropdown so you choose which vault to unlock.
- **Shared vs. isolated vaults:**
  - Vaults with `allowGlobalAuth: true` accept tokens from `PAGEDEX_AUTH_TOKEN_FILE` (plus their own `authTokenFile`, if configured).
  - Vaults with `allowGlobalAuth: false` only accept their own `authTokenFile` — a global token cannot unlock them.
- **Multi-session cookies:** `pagedex_auth` stores signed session entries for every vault you have unlocked in the current browser session. Switching between already-unlocked vaults in the sidebar works without re-entering passwords; switching to a locked vault prompts the login screen for that vault. Clicking **Sign out** clears all unlocked vault sessions.

## Live Auto-Reload

`pagedex` watches the `PAGEDEX_ROOT_CONFIG` file for edits:
- Adding a vault initializes its cache, SQLite search index, and `fs.watch` live reloader immediately.
- Updating `authTokenFile`, `mcpTokenFile`, `allowGlobalAuth`, or `readOnly` takes effect without a restart.
- Removing a vault closes its file watcher and search index cleanly.

## Selecting Vaults via REST & MCP

Requests resolve the target vault in this order:
1. `?vault=<id>` query parameter
2. `X-Pagedex-Vault` HTTP header
3. `pagedex_vault` cookie
4. `default` vault from config

### REST Endpoints

- `GET /api/v1/vaults` — returns `{ activeVault, multiVault, vaults: [{ id, readOnly }] }`.
- `POST /api/v1/vault/select` — `{ "vault": "work" }` updates the `pagedex_vault` cookie (returns `401` if the current session is not authorized for that vault, or `404` if unknown).

### MCP (`/mcp`)

Point an MCP client at a specific vault using `?vault=<id>` or the `X-Pagedex-Vault` header:

```json
{
  "mcpServers": {
    "pagedex-work": {
      "url": "http://127.0.0.1:4321/mcp?vault=work",
      "headers": {
        "Authorization": "Bearer <work-mcp-token>"
      }
    }
  }
}
```
