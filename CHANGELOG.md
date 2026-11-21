# Changelog

All notable changes to `pagedex` will be documented in this file.

## [0.1.16] - 2026-11-21

### Features

- **ui:** auto-collapse .ipynb_checkpoints folders (dff5861)
- **ui:** move vault switcher dropdown to sidebar footer (c94c1f4)

### Bug Fixes

- **ui:** truncate sidebar folder names with ellipsis (033a8ec)

## [0.1.15] - 2026-11-21

### Features

- **files:** add folder deletion with non-empty warning (bc214ba)
- **viewer:** add read-only ipynb notebook rendering (28774ad)

### Bug Fixes

- **files:** return JSON error and status on folder delete (9ab8f12)

## [0.1.14] - 2026-11-20

### Features

- **markdown:** render inline and block LaTeX math with KaTeX (523a9cf)
- **server:** fall back to random port on EADDRINUSE and defer startup indexing (bfbbab3)

### Tests

- use ephemeral port 0 and fail-fast startup checks (4c6a1af)

## [0.1.13] - 2026-11-19

### Features

- **ui,auth:** add multi-vault login selector, multi-session cookies, and New Tab welcome heading (4ce2a6d)
- **multi-vault:** add PAGEDEX_ROOT_CONFIG (--config) with per-vault auth, allowGlobalAuth, and auto-reload (49a8c8d)
- **ui:** add Cmd/Ctrl+Shift+E shortcut to toggle Raw mode (4cefd33)
- **print:** add A4 multi-page print layout, light Mermaid print render, and Print menu button (598e61a)
- **editor:** allow editing all non-binary text files in RawEditor (5778830)
- **ui:** add Open Tabs tab in Quick Switcher and Cmd/Ctrl+/ outline toggle (a3d7f20)
- **sidebar:** open file in new tab on Cmd/Ctrl+Click or middle-click (7fd12d9)
- **ui:** add Cmd+O/Cmd+S shortcuts, tab cycling, Shortcuts tab, and tab deduplication (e7f9d8f)

### Bug Fixes

- **ui,test:** fix Mermaid strict-mode locator, restore Edit note aria-label, and improve inline code contrast (f3db210)

### Documentation

- add Multi-Vault Guide and refine README comparison strengths (fc91374)
- **readme:** add multi-vault row and PageDex vs Obsidian vs Notion comparison table (590e659)
- sync README, docs, and AGENTS.md with print, text editing, auth, and test updates (b474599)

## [0.1.12] - 2026-11-19

### Bug Fixes

- **ui,sw:** bypass SSE/API in service worker, enable desktop left sidebar toggle, and align tab bar height (dd61458)

### Documentation

- document reverse proxy X-Frame-Options exclusion for /raw/* (58dc10c)

## [0.1.11] - 2026-11-19

### Documentation

- add macOS launchd and Linux systemd service setup to README (a1309cf)

### Other Changes

- add backups to autoCollapsed defaults and add pnpm vault script (f9169b5)

## [0.1.10] - 2026-11-17

### Features

- **ui:** add 1-click topbar Pencil/Eye toggle between preview and edit (ba62cd3)
- **preview:** render mermaid diagrams lazily with quote-safe HTML extraction (02dd0ad)
- **editor:** add Raw/Edit toolbar toggle and top-right code block language selector (e2d0cbe)
- **ui:** add New note/folder here to file menu and editable Raw Markdown mode (e8a9c51)

## [0.1.9] - 2026-11-16

### Features

- **auth:** add global failed-attempt rate limit on /api/v1/auth/login (788e069)

## [0.1.8] - 2026-11-15

### Features

- **mcp:** support comma-separated key rotation in --mcp-token-file (7507a10)
- **auth:** add --auth-token-file for Web/REST auth with key rotation, tests, and README screenshot (e287584)
- **pwa:** add manifest, service worker, P icon set, and README logo header (483a9de)

### Bug Fixes

- **ui:** align FileContextMenu and NoteViewer action menu with small-screen scrolling (86f9374)

### Documentation

- add Codex to README and move Screenshots above Quick Start (a87663a)
- tighten README tagline and Obsidian/Git audience rows (ab5c4cf)
- refresh screenshots with PageDex P branding and capitalize PageDex in README (6e64487)

### Other Changes

- **ui:** rename sidebar brand label and icon filenames to PageDex (58d01c3)

## [0.1.7] - 2026-11-15

### Features

- **ui:** add UX quick wins, read-only UI, updated API/MCP settings, and 10 Playwright E2E specs (4765904)

### Documentation

- **readme:** improve layout, hero screenshot, MCP snippet, and docs index (267bb49)
- **readme:** add overview description and target audience table (f052961)

## [0.1.6] - 2026-11-15

### Features

- **mcp:** add --mcp modes, --mcp-token-file, --mcp-git, --read-only, 7 new tools, and docs (d5dc725)

### Bug Fixes

- **smoke:** update MCP tool count assertion and add UI screenshots to docs (0accaea)

## [0.1.5] - 2026-11-15

### Features

- **sidebar:** add collapsible Pinned section, scrollable row menu, and lucide-react icons (f91dd56)
- **ui:** split Rename and Move dialogs with reusable FolderPicker (47a6948)
- **ui:** open newly created note in a new tab when another file is open (af49968)

### Bug Fixes

- **ui:** compact expandable FolderPicker, static TiptapEditor import, and preview on new note (7900771)
- **ui:** default to new tab, fix SSE reload race, and add Playwright suite (d8b2049)
- **tabs:** avoid stale activeTabId in StrictMode and missing README blank state (b120cdc)
- **search:** only exclude hiddenFolders from Quick Switcher, not autoCollapsed (337757b)

### Tests

- **playwright:** add edit-save, tabs-wikilinks, and delete-switcher E2E specs (fa82a8c)

### CI

- run Playwright tests in CI workflow (4de3a22)

### Other Changes

- **sidebar:** visually separate Pinned group and All files divider (29b8b11)
- **tabs:** share openInNewTab between FileContextMenu and confirmNewNote (11357c7)

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
