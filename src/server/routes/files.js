import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  MIME_TYPES,
  getVaultRoot,
  createDir,
  deleteDir,
  deleteNote,
  editNote,
  getCachedVault,
  invalidateVaultCache,
  isProtectedPath,
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

import { getActiveVault, isVaultReadOnly } from '../vault-manager.js';

const PACKAGE_ROOT = path.resolve(import.meta.dirname, '../../..');
const SERVER_INFO = (() => {
  let version = null;
  let commit = null;
  let builtAt = null;
  try {
    const info = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'dist/build-info.json'), 'utf8'));
    version = info.version || null;
    commit = info.commit || null;
    builtAt = info.builtAt || null;
  } catch {}
  if (!version) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8'));
      version = pkg.version || null;
    } catch {}
  }
  if (!commit) {
    try {
      commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
        cwd: PACKAGE_ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      }).trim() || null;
    } catch {}
  }
  return { version, commit, builtAt, startedAt: new Date().toISOString() };
})();

export function registerFileRoutes(app) {
  app.get('/api/v1/health', (c) => {
    const vault = getActiveVault();
    return c.json({
      ok: true,
      vault: vault.id,
      root: getVaultRoot(),
      readOnly: isVaultReadOnly(vault),
      ...SERVER_INFO
    });
  });

  app.get('/api/v1/tree', (c) => {
    if (c.req.query('refresh') === '1') {
      invalidateVaultCache();
    }
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

function buildRequestOrigins(c) {
  const url = new URL(c.req.url);
  const proto = (c.req.header('x-forwarded-proto') || url.protocol.replace(':', '')).split(',')[0].trim();
  const host = (c.req.header('x-forwarded-host') || c.req.header('host') || url.host).split(',')[0].trim();
  const origins = new Set([`${proto}://${host}`]);
  const referer = c.req.header('referer');
  if (referer) {
    try {
      origins.add(new URL(referer).origin);
    } catch {
      // ignore invalid referer
    }
  }
  return Array.from(origins).join(' ');
}

function serveFileResponse(c, full, contentType, { isDownload = false, extraHeaders = {} } = {}) {
  const stat = fs.statSync(full);
  const size = stat.size;
  const headers = {
    'Content-Type': contentType,
    'Accept-Ranges': 'bytes',
    ...extraHeaders
  };
  if (isDownload) {
    const fileName = path.basename(full).replace(/"/g, '');
    headers['Content-Disposition'] = `attachment; filename="${fileName}"`;
  }

  const rangeHeader = !isDownload ? c.req.header('range') : null;
  if (rangeHeader && rangeHeader.startsWith('bytes=')) {
    const [rawStart, rawEnd] = rangeHeader.slice(6).split('-');
    let start = rawStart === '' ? 0 : Number(rawStart);
    let end = rawEnd === '' ? size - 1 : Number(rawEnd);
    if (rawStart === '' && rawEnd !== '') {
      start = Math.max(0, size - Number(rawEnd));
      end = size - 1;
    }
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end >= size || start > end) {
      return new Response(null, {
        status: 416,
        headers: { 'Content-Range': `bytes */${size}` }
      });
    }
    const chunkLen = end - start + 1;
    const fd = fs.openSync(full, 'r');
    const slice = Buffer.alloc(chunkLen);
    try {
      fs.readSync(fd, slice, 0, chunkLen, start);
    } finally {
      fs.closeSync(fd);
    }
    return new Response(slice, {
      status: 206,
      headers: {
        ...headers,
        'Content-Range': `bytes ${start}-${end}/${size}`,
        'Content-Length': String(chunkLen)
      }
    });
  }

  const buf = fs.readFileSync(full);
  return new Response(buf, { status: 200, headers });
}

  app.get('/api/v1/file', (c) => {
    const rel = c.req.query('path') || '';
    const full = resolveSafe(rel);
    if (!full || !fs.existsSync(full) || !fs.statSync(full).isFile()) {
      return c.text('Not found', 404);
    }
    const ext = path.extname(full).toLowerCase();
    const isDownload = c.req.query('download') === '1';
    const contentType = MIME_TYPES[ext] || (isDownload ? 'application/octet-stream' : 'text/plain; charset=utf-8');
    return serveFileResponse(c, full, contentType, { isDownload });
  });

  app.get('/raw/*', (c) => {
    let rel = '';
    try {
      rel = decodeURIComponent(c.req.path.replace(/^\/raw\/?/, ''));
    } catch {
      return c.text('Bad path', 400);
    }
    if (!rel || isProtectedPath(rel) || path.basename(rel).startsWith('.env')) {
      return c.text('Not found', 404);
    }
    const full = resolveSafe(rel);
    if (!full || !fs.existsSync(full) || !fs.statSync(full).isFile()) {
      return c.text('Not found', 404);
    }
    const ext = path.extname(full).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const extraHeaders = {
      'Access-Control-Allow-Origin': '*'
    };
    if (ext === '.html' || ext === '.htm') {
      const origins = buildRequestOrigins(c);
      extraHeaders['Content-Security-Policy'] =
        `default-src ${origins} 'unsafe-inline' 'unsafe-eval' data: blob:`;
    }
    return serveFileResponse(c, full, contentType, { extraHeaders });
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

  app.delete('/api/v1/dir', (c) => {
    const rel = c.req.query('path') || '';
    try {
      const result = deleteDir(rel);
      if (!result) return c.json({ error: 'Not found or protected path' }, 404);
      syncIndex();
      return c.json(result);
    } catch (err) {
      return c.json({ error: err?.message || 'Failed to delete folder' }, 500);
    }
  });

  app.post('/api/v1/dir', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body.path !== 'string') {
      return c.json({ error: 'Expected JSON { path }' }, 400);
    }
    const result = createDir(body.path);
    if (result.error) return c.json(result, 400);
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
