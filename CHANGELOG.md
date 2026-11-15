# Changelog

All notable changes to `pagedex` will be documented in this file.

## [0.1.4] - 2026-11-15

### Documentation

- expand user documentation with getting started and MCP/REST guides (2a716bc)

### Other Changes

- include docs/ in npm package files (6af7a3a)

## [0.1.3] - 2026-11-15

### Features

- **ui:** add Download action above Preview in top-right menu (d178640)
- add HTML sandbox, PDF, audio/video, CSV/TSV, and markdown/mdx support (f63232a)
- **cli:** add bin/pagedex.js CLI entrypoint (bd8b7cd)
- **client:** add React + Tiptap UI with mobile edge-swipe and Vite config (5fca00f)
- **server:** add Hono REST, Git, SSE, FTS5, and MCP v2 server (e6a7b32)

### Bug Fixes

- preserve forwarded origin in raw HTML CSP for Vite dev proxy (d95df2a)
- **ci:** specify pnpm version 10 for pnpm/action-setup (4212304)

### Tests

- add REST, Git, and multi-era MCP v2 test suites (99951b7)

### Documentation

- add human docs/ and AI agent .agents/ documentation (37268fe)
- explain the pagedex name in README.md (9296210)
- add README.md, AGENTS.md, and CLAUDE.md (b11c2ce)

### CI

- **release:** create annotated tag and push tag explicitly for gh release (9112621)
- **release:** use npm stage publish for stage-only OIDC trusted publishing (10dd407)
- generate CHANGELOG.md automatically on release (60252fa)
- add GitHub Actions CI and manual OIDC release workflow (c1b38db)

### Other Changes

- add repository field to package.json for npm OIDC provenance (8eaa55d)
- initialize pagedex repository, package.json, and .gitignore (92f9d1e)

## [0.1.2] - 2026-11-15

### Features

- **ui:** add Download action above Preview in top-right menu (d178640)
- add HTML sandbox, PDF, audio/video, CSV/TSV, and markdown/mdx support (f63232a)
- **cli:** add bin/pagedex.js CLI entrypoint (bd8b7cd)
- **client:** add React + Tiptap UI with mobile edge-swipe and Vite config (5fca00f)
- **server:** add Hono REST, Git, SSE, FTS5, and MCP v2 server (e6a7b32)

### Bug Fixes

- preserve forwarded origin in raw HTML CSP for Vite dev proxy (d95df2a)
- **ci:** specify pnpm version 10 for pnpm/action-setup (4212304)

### Tests

- add REST, Git, and multi-era MCP v2 test suites (99951b7)

### Documentation

- add human docs/ and AI agent .agents/ documentation (37268fe)
- explain the pagedex name in README.md (9296210)
- add README.md, AGENTS.md, and CLAUDE.md (b11c2ce)

### CI

- **release:** use npm stage publish for stage-only OIDC trusted publishing (10dd407)
- generate CHANGELOG.md automatically on release (60252fa)
- add GitHub Actions CI and manual OIDC release workflow (c1b38db)

### Other Changes

- add repository field to package.json for npm OIDC provenance (8eaa55d)
- initialize pagedex repository, package.json, and .gitignore (92f9d1e)

## [0.1.1] - 2026-11-15

### Features

- **ui:** add Download action above Preview in top-right menu (d178640)
- add HTML sandbox, PDF, audio/video, CSV/TSV, and markdown/mdx support (f63232a)
- **cli:** add bin/pagedex.js CLI entrypoint (bd8b7cd)
- **client:** add React + Tiptap UI with mobile edge-swipe and Vite config (5fca00f)
- **server:** add Hono REST, Git, SSE, FTS5, and MCP v2 server (e6a7b32)

### Bug Fixes

- preserve forwarded origin in raw HTML CSP for Vite dev proxy (d95df2a)
- **ci:** specify pnpm version 10 for pnpm/action-setup (4212304)

### Tests

- add REST, Git, and multi-era MCP v2 test suites (99951b7)

### Documentation

- add human docs/ and AI agent .agents/ documentation (37268fe)
- explain the pagedex name in README.md (9296210)
- add README.md, AGENTS.md, and CLAUDE.md (b11c2ce)

### CI

- generate CHANGELOG.md automatically on release (60252fa)
- add GitHub Actions CI and manual OIDC release workflow (c1b38db)

### Other Changes

- initialize pagedex repository, package.json, and .gitignore (92f9d1e)
