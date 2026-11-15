import fs from 'node:fs';
import path from 'node:path';
import {
  IMAGE_MIME,
   VAULT_ROOT,
  deleteNote,
  editNote,
  getCachedVault,
  renameDir,
  renameNote,
  resolveSafe,
  sortTree,
  writeBinaryFile,
  writeNote
} from '../vault.js';
import {
  queryFiles,
  removeFileFromIndex,
  searchFts,
  syncIndex,
  upsertFileInIndex
} from '../search-index.js';

export function registerFileRoutes(app) {
  app.get('/api/v1/health', (c) => c.json({ ok: true, root: VAULT_ROOT }));

  app.get('/api/v1/tree', (c) => {
    const rawLimit = Number(c.req.query('limit') || 10000);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 10000) : 10000;
    const sort = c.req.query('sort'); // 'mtime' | 'name' | undefined
    const { tree, flatFiles, fileStats, sortedStats, backlinks } = getCachedVault();
    const outTree = sort === 'mtime' ? sortTree(tree, 'mtime') : tree;
    const outStats =
      sort === 'name'
        ? [...fileStats].sort((a, b) => a.path.localeCompare(b.path)).slice(0, limit)
        : sortedStats.slice(0, limit);
    return c.json({
      tree: outTree,
      flatFiles,
      fileStats: outStats,
      totalFiles: sortedStats.length,
      truncated: sortedStats.length > limit,
      backlinks
    });
  });

  app.get('/api/v1/files', (c) => {
    const sort = c.req.query('sort') === 'name' ? 'name' : 'mtime';
    const offset = Number(c.req.query('offset') || 0);
    const limit = Number(c.req.query('limit') || 100);
    const q = c.req.query('q') || '';
    return c.json(queryFiles({ sort, offset, limit, q }));
  });

  app.get('/api/v1/search', (c) => {
    const q = c.req.query('q') || '';
    const limit = Number(c.req.query('limit') || 50);
    return c.json({ query: q, results: searchFts(q, limit) });
  });

  app.get('/api/v1/file', (c) => {
    const rel = c.req.query('path') || '';
    const full = resolveSafe(rel);
    if (!full || !fs.existsSync(full) || !fs.statSync(full).isFile()) {
      return c.text('Not found', 404);
    }
    const ext = path.extname(full).toLowerCase();
    const isDownload = c.req.query('download') === '1';
    const contentType = IMAGE_MIME[ext] || (isDownload ? 'application/octet-stream' : 'text/plain; charset=utf-8');
    const buf = fs.readFileSync(full);
    const headers = { 'Content-Type': contentType };
    if (isDownload) {
      const fileName = path.basename(full).replace(/"/g, '');
      headers['Content-Disposition'] = `attachment; filename="${fileName}"`;
    }
    return new Response(buf, { status: 200, headers });
  });

  async function handleWriteOrEdit(c) {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body.path !== 'string') {
      return c.json({ error: 'Expected JSON with path' }, 400);
    }
    if (typeof body.target === 'string' && typeof body.replacement === 'string') {
      const result = editNote(body.path, body.target, body.replacement, {
        replaceAll: Boolean(body.replaceAll)
      });
      if (result.error) return c.json(result, 400);
      upsertFileInIndex(result.path);
      return c.json(result);
    }
    if (typeof body.content === 'string') {
      const result = writeNote(body.path, body.content, { append: Boolean(body.append) });
      if (!result) return c.json({ error: 'Invalid or protected path' }, 400);
      upsertFileInIndex(result.path);
      return c.json(result);
    }
    return c.json({ error: 'Provide either { content } or { target, replacement }' }, 400);
  }

  app.put('/api/v1/file', handleWriteOrEdit);
  app.post('/api/v1/file', handleWriteOrEdit);
  app.patch('/api/v1/file', handleWriteOrEdit);

  app.delete('/api/v1/file', (c) => {
    const rel = c.req.query('path') || '';
    const result = deleteNote(rel);
    if (!result) return c.json({ error: 'Not found or protected path' }, 404);
    removeFileFromIndex(result.path);
    return c.json(result);
  });

  app.post('/api/v1/file/rename', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body.oldPath !== 'string' || typeof body.newPath !== 'string') {
      return c.json({ error: 'Expected JSON { oldPath, newPath }' }, 400);
    }
    const result = renameNote(body.oldPath, body.newPath);
    if (result.error) return c.json(result, 400);
    removeFileFromIndex(result.oldPath);
    upsertFileInIndex(result.newPath);
    return c.json(result);
  });

  app.post('/api/v1/dir/rename', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body.oldPath !== 'string' || typeof body.newPath !== 'string') {
      return c.json({ error: 'Expected JSON { oldPath, newPath }' }, 400);
    }
    const result = renameDir(body.oldPath, body.newPath);
    if (result.error) return c.json(result, 400);
    syncIndex();
    return c.json(result);
  });

  app.post('/api/v1/file/upload', async (c) => {
    const body = await c.req.parseBody({ all: true }).catch(() => null);
    if (!body) {
      return c.json({ error: 'Expected multipart/form-data' }, 400);
    }
    const dir = typeof body.dir === 'string' ? body.dir.trim().replace(/^\/+|\/+$/g, '') : '';
    const rawFiles = body.files ?? body.file;
    const list = (Array.isArray(rawFiles) ? rawFiles : rawFiles ? [rawFiles] : []).filter(
      (item) => item && typeof item === 'object' && typeof item.arrayBuffer === 'function' && item.name
    );
    if (list.length === 0) {
      return c.json({ error: 'No files provided' }, 400);
    }
    const uploaded = [];
    for (const file of list) {
      const safeName = path.basename(String(file.name));
      if (!safeName || safeName === '.' || safeName === '..') {
        return c.json({ error: 'Invalid filename' }, 400);
      }
      const relPath = dir ? `${dir}/${safeName}` : safeName;
      const buf = Buffer.from(await file.arrayBuffer());
      const result = writeBinaryFile(relPath, buf);
      if (!result) {
        return c.json({ error: `Invalid or protected path: ${relPath}` }, 400);
      }
      upsertFileInIndex(result.path);
      uploaded.push(result);
    }
    return c.json({ ok: true, uploaded });
  });
}
