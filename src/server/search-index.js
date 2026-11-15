import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { IGNORED, VAULT_ROOT, isImagePath, isProtectedPath, resolveSafe } from './vault.js';

const BINARY_EXT_RE = /\.(png|jpe?g|gif|webp|svg|ico|epub|pdf|zip|tar|gz|tgz|7z|rar|docx?|xlsx?|pptx?|odt|ods|odp|mp3|wav|m4a|mp4|mov|webm|mkv|avi|dmg|exe|bin|whl|sqlite|db)$/i;
const MAX_INDEX_BYTES = 2 * 1024 * 1024;

let db = null;
let syncedOnce = false;

function isTextIndexable(relPath, size) {
  if (isImagePath(relPath) || BINARY_EXT_RE.test(relPath)) return false;
  return size <= MAX_INDEX_BYTES;
}

function resolveDbPath() {
  if (process.env.PAGEDEX_INDEX_PATH) return path.resolve(process.env.PAGEDEX_INDEX_PATH);
  const cacheDir = process.env.PAGEDEX_INDEX_DIR || path.join(os.homedir(), '.cache', 'pagedex');
  fs.mkdirSync(cacheDir, { recursive: true });
  const hash = createHash('sha256').update(VAULT_ROOT).digest('hex').slice(0, 16);
  return path.join(cacheDir, `${hash}.db`);
}

function getDb() {
  if (db) return db;
  const dbPath = resolveDbPath();
  db = new DatabaseSync(dbPath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    CREATE TABLE IF NOT EXISTS files (
      path TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      mtime_ms INTEGER NOT NULL,
      size INTEGER NOT NULL,
      is_text INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_files_mtime ON files(mtime_ms DESC, path ASC);
    CREATE INDEX IF NOT EXISTS idx_files_name ON files(name COLLATE NOCASE ASC, path ASC);
    CREATE VIRTUAL TABLE IF NOT EXISTS docs_fts USING fts5(
      path,
      content,
      tokenize='trigram'
    );
  `);
  return db;
}

function walkDiskFiles(dir = VAULT_ROOT, relBase = '', out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (IGNORED.has(entry.name)) continue;
    const rel = relBase ? `${relBase}/${entry.name}` : entry.name;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDiskFiles(full, rel, out);
    } else if (entry.isFile()) {
      try {
        const st = fs.statSync(full);
        out.push({
          path: rel,
          name: entry.name,
          mtimeMs: Math.round(st.mtimeMs),
          size: st.size,
          full
        });
      } catch {
        // Ignore unreadable transient files
      }
    }
  }
  return out;
}

export function syncIndex() {
  const conn = getDb();
  const diskFiles = walkDiskFiles();
  const diskMap = new Map(diskFiles.map((f) => [f.path, f]));

  const existingRows = conn.prepare('SELECT path, mtime_ms, size FROM files').all();
  const existingMap = new Map(existingRows.map((r) => [r.path, r]));

  const delFile = conn.prepare('DELETE FROM files WHERE path = ?');
  const delFts = conn.prepare('DELETE FROM docs_fts WHERE path = ?');
  const upsertFile = conn.prepare(`
    INSERT INTO files (path, name, mtime_ms, size, is_text)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(path) DO UPDATE SET
      name = excluded.name,
      mtime_ms = excluded.mtime_ms,
      size = excluded.size,
      is_text = excluded.is_text
  `);
  const insertFts = conn.prepare('INSERT INTO docs_fts (path, content) VALUES (?, ?)');

  conn.exec('BEGIN');
  try {
    for (const row of existingRows) {
      if (!diskMap.has(row.path)) {
        delFile.run(row.path);
        delFts.run(row.path);
      }
    }
    for (const f of diskFiles) {
      const prev = existingMap.get(f.path);
      if (prev && prev.mtime_ms === f.mtimeMs && prev.size === f.size) continue;
      const textable = isTextIndexable(f.path, f.size);
      let content = '';
      if (textable) {
        try {
          content = fs.readFileSync(f.full, 'utf8');
        } catch {
          content = '';
        }
      }
      upsertFile.run(f.path, f.name, f.mtimeMs, f.size, textable ? 1 : 0);
      delFts.run(f.path);
      if (textable) {
        insertFts.run(f.path, content);
      }
    }
    conn.exec('COMMIT');
  } catch (err) {
    conn.exec('ROLLBACK');
    throw err;
  }
  syncedOnce = true;
  return { total: diskFiles.length };
}

function ensureSynced() {
  if (!syncedOnce) syncIndex();
}

export function upsertFileInIndex(relPath) {
  if (!relPath || isProtectedPath(relPath)) return;
  const clean = relPath.replace(/^\/+/, '');
  const full = resolveSafe(clean);
  if (!full) return;

  const conn = getDb();
  if (!fs.existsSync(full)) {
    removeFileFromIndex(clean);
    return;
  }
  let st;
  try {
    st = fs.statSync(full);
  } catch {
    return;
  }
  if (st.isDirectory()) {
    syncIndex();
    return;
  }
  if (!st.isFile()) return;

  const mtimeMs = Math.round(st.mtimeMs);
  const textable = isTextIndexable(clean, st.size);
  let content = '';
  if (textable) {
    try {
      content = fs.readFileSync(full, 'utf8');
    } catch {
      content = '';
    }
  }

  conn.exec('BEGIN');
  try {
    conn
      .prepare(
        `INSERT INTO files (path, name, mtime_ms, size, is_text)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(path) DO UPDATE SET
           name = excluded.name,
           mtime_ms = excluded.mtime_ms,
           size = excluded.size,
           is_text = excluded.is_text`
      )
      .run(clean, path.basename(clean), mtimeMs, st.size, textable ? 1 : 0);
    conn.prepare('DELETE FROM docs_fts WHERE path = ?').run(clean);
    if (textable) {
      conn.prepare('INSERT INTO docs_fts (path, content) VALUES (?, ?)').run(clean, content);
    }
    conn.exec('COMMIT');
  } catch (err) {
    conn.exec('ROLLBACK');
    throw err;
  }
}

export function removeFileFromIndex(relPath) {
  if (!relPath) return;
  const clean = relPath.replace(/^\/+/, '');
  const conn = getDb();
  conn.prepare('DELETE FROM files WHERE path = ?').run(clean);
  conn.prepare('DELETE FROM docs_fts WHERE path = ?').run(clean);
}

export function queryFiles({ sort = 'mtime', offset = 0, limit = 100, q = '' } = {}) {
  ensureSynced();
  const conn = getDb();
  const safeOffset = Math.max(0, Number(offset) || 0);
  const safeLimit = Math.min(1000, Math.max(1, Number(limit) || 100));
  const orderBy = sort === 'name' ? 'name COLLATE NOCASE ASC, path ASC' : 'mtime_ms DESC, path ASC';
  const cleanQ = String(q || '').trim().toLowerCase();

  let total;
  let rows;
  if (cleanQ) {
    const pattern = `%${cleanQ.replace(/[%_\\]/g, '\\$&')}%`;
    total = conn
      .prepare("SELECT COUNT(*) AS cnt FROM files WHERE lower(path) LIKE ? ESCAPE '\\'")
      .get(pattern).cnt;
    rows = conn
      .prepare(
        `SELECT path, mtime_ms AS mtimeMs FROM files
         WHERE lower(path) LIKE ? ESCAPE '\\'
         ORDER BY ${orderBy}
         LIMIT ? OFFSET ?`
      )
      .all(pattern, safeLimit, safeOffset);
  } else {
    total = conn.prepare('SELECT COUNT(*) AS cnt FROM files').get().cnt;
    rows = conn
      .prepare(
        `SELECT path, mtime_ms AS mtimeMs FROM files
         ORDER BY ${orderBy}
         LIMIT ? OFFSET ?`
      )
      .all(safeLimit, safeOffset);
  }

  return {
    items: rows,
    total,
    offset: safeOffset,
    limit: safeLimit,
    hasMore: safeOffset + rows.length < total
  };
}

export function searchFts(query, limit = 50) {
  ensureSynced();
  const q = String(query || '').trim();
  if (!q) return [];
  const conn = getDb();
  const safeLimit = Math.min(200, Math.max(1, Number(limit) || 50));

  if (q.length >= 3) {
    // Trigram FTS5 expects double-quoted literal; escape internal quotes
    const ftsLiteral = `"${q.replace(/"/g, '""')}"`;
    const rows = conn
      .prepare(
        `SELECT docs_fts.path AS path,
                COALESCE(files.mtime_ms, 0) AS mtimeMs,
                snippet(docs_fts, 1, '', '', '...', 16) AS snippet
         FROM docs_fts
         LEFT JOIN files ON files.path = docs_fts.path
         WHERE docs_fts MATCH ?
         ORDER BY files.mtime_ms DESC, docs_fts.path ASC
         LIMIT ?`
      )
      .all(ftsLiteral, safeLimit);

    // Also include non-text files whose path matches q (since non-text files aren't in docs_fts)
    if (rows.length < safeLimit) {
      const seen = new Set(rows.map((r) => r.path));
      const pattern = `%${q.toLowerCase().replace(/[%_\\]/g, '\\$&')}%`;
      const pathOnly = conn
        .prepare(
          `SELECT path, mtime_ms AS mtimeMs FROM files
           WHERE is_text = 0 AND lower(path) LIKE ? ESCAPE '\\'
           ORDER BY mtime_ms DESC
           LIMIT ?`
        )
        .all(pattern, safeLimit - rows.length);
      for (const r of pathOnly) {
        if (!seen.has(r.path)) rows.push({ path: r.path, mtimeMs: r.mtimeMs, snippet: '' });
      }
    }
    return rows;
  }

  // Short queries (1-2 chars): trigram requires >=3 chars, so match path + scan recent text files
  const lowerQ = q.toLowerCase();
  const pattern = `%${lowerQ.replace(/[%_\\]/g, '\\$&')}%`;
  const results = [];
  const seen = new Set();

  const pathRows = conn
    .prepare(
      `SELECT path, mtime_ms AS mtimeMs FROM files
       WHERE lower(path) LIKE ? ESCAPE '\\'
       ORDER BY mtime_ms DESC
       LIMIT ?`
    )
    .all(pattern, safeLimit);

  for (const r of pathRows) {
    seen.add(r.path);
    results.push({ path: r.path, mtimeMs: r.mtimeMs, snippet: '' });
  }

  if (results.length < safeLimit) {
    const recentText = conn
      .prepare('SELECT path, mtime_ms AS mtimeMs FROM files WHERE is_text = 1 ORDER BY mtime_ms DESC LIMIT 500')
      .all();
    for (const r of recentText) {
      if (seen.has(r.path)) continue;
      const full = path.join(VAULT_ROOT, r.path);
      try {
        const text = fs.readFileSync(full, 'utf8');
        const idx = text.toLowerCase().indexOf(lowerQ);
        if (idx !== -1) {
          const snippet = text
            .slice(Math.max(0, idx - 60), Math.min(text.length, idx + q.length + 100))
            .replace(/\s+/g, ' ')
            .trim();
          results.push({ path: r.path, mtimeMs: r.mtimeMs, snippet });
          if (results.length >= safeLimit) break;
        }
      } catch {
        // Ignore transient read error
      }
    }
  }
  return results;
}
