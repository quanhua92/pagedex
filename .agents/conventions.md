# Conventions & Playbooks

## Adding Support for a New File Type

1. **MIME type (`src/server/paths.js`):** Add the extension to `MIME_TYPES` (and `IMAGE_MIME` if it is a raster/vector image).
2. **Search indexing (`src/server/search-index.js`):** If the format is binary, ensure `BINARY_EXT_RE` excludes it from FTS5 text indexing.
3. **Client predicate (`src/client/lib/paths.js`):** Add an `is<Type>Path(p)` helper and remove the extension from `isDownloadOnlyPath(p)` if it was previously download-only.
4. **Loading behavior (`src/client/App.jsx`):**
   - If the viewer uses `<iframe src>`, `<audio>`, or `<video>`, include the predicate in `isBinaryMedia` inside `openFile()` so `App.jsx` sends `HEAD` instead of `res.text()`.
   - Pass the boolean flag to `NoteViewer`.
5. **Renderer (`src/client/components/NoteViewer.jsx` & `src/client/styles.css`):** Add the render branch and layout styles.
6. **Docs & Tests:** Update `docs/supported-files.md` and add coverage in `test/api-mcp.test.js`.

## Verification Checklist

Run before committing:

```bash
pnpm build   # Verifies Vite client bundle & dist/ output
pnpm test    # Runs test/api-mcp.test.js (binds local ports 4591/4592)
pnpm smoke   # Optional: runs against live :4321 server
```

Note: In sandboxed environments where binding/connecting to `127.0.0.1` is blocked (`EPERM`), `pnpm test` and `pnpm smoke` must run outside the port-binding sandbox.

## npm Release Check

`package.json` `"files"` controls what ships (`bin/`, `src/server/`, `dist/`, `docs/`, `README.md`). Confirm with:

```bash
npm pack --dry-run
```
