# pagedex Documentation

User, integration, and developer guides for **pagedex**.

- [Getting Started](./getting-started.md) — CLI flags, environment variables, UI features, wikilinks, Git sync, and mobile gestures.
- [Multi-Vault Guide](./multi-vault.md) — Serving multiple vaults via `--config` / `PAGEDEX_ROOT_CONFIG`, `allowGlobalAuth`, per-vault tokens, and auto-reload.
- [Supported File Types](./supported-files.md) — Markdown/MDX, sandboxed HTML + sibling assets, PDF, audio/video, CSV/TSV, SVG, code, and binaries.
- [MCP Server Guide](./MCP.md) — MCP modes (`read`, `write`, `full`, `off`), `--mcp-token-file`, `--mcp-git`, and all 12 vault tools.
- [MCP & REST API](./mcp-and-api.md) — Quick reference for `/mcp`, REST endpoints, `/raw/*`, and SSE live reload.
- [Security Model](./security.md) — Sandboxed HTML iframes, CSP/CORS behavior, `Origin: null` guard, and path protection.
- [Development & Release](./development.md) — Running `pnpm dev`, unit & smoke tests, and npm packaging.
