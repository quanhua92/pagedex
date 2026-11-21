import fs from 'node:fs';
import path from 'node:path';
import { getVaultRoot, isProtectedPath, resolveSafe } from './paths.js';
import { invalidateVaultCache, removeVaultCacheFile, updateVaultCacheFile } from './vault-cache.js';

export function writeNote(relPath, content, { append = false } = {}) {
  if (!relPath || isProtectedPath(relPath)) return null;
  const full = resolveSafe(relPath);
  if (!full || full === getVaultRoot()) return null;
  fs.mkdirSync(path.dirname(full), { recursive: true });
  if (append && fs.existsSync(full)) {
    fs.appendFileSync(full, String(content ?? ''), 'utf8');
  } else {
    fs.writeFileSync(full, String(content ?? ''), 'utf8');
  }
  const clean = relPath.replace(/^\/+/, '');
  updateVaultCacheFile(clean);
  return { path: clean, bytes: Buffer.byteLength(String(content ?? ''), 'utf8') };
}

export function editNote(relPath, target, replacement, { replaceAll = false } = {}) {
  if (!relPath || isProtectedPath(relPath) || typeof target !== 'string' || !target) {
    return { error: 'Invalid path or empty target' };
  }
  const full = resolveSafe(relPath);
  if (!full || !fs.existsSync(full) || !fs.statSync(full).isFile()) {
    return { error: 'File not found' };
  }
  const current = fs.readFileSync(full, 'utf8');
  if (!current.includes(target)) {
    return { error: 'Target not found in file' };
  }
  const count = current.split(target).length - 1;
  if (count > 1 && !replaceAll) {
    return { error: `Target matched ${count} times; pass replaceAll: true or more context` };
  }
  const next = replaceAll ? current.split(target).join(String(replacement ?? '')) : current.replace(target, String(replacement ?? ''));
  const clean = relPath.replace(/^\/+/, '');
  fs.writeFileSync(full, next, 'utf8');
  updateVaultCacheFile(clean);
  return {
    path: clean,
    replacements: replaceAll ? count : 1,
    bytes: Buffer.byteLength(next, 'utf8')
  };
}

export function deleteNote(relPath) {
  if (!relPath || isProtectedPath(relPath)) return null;
  const full = resolveSafe(relPath);
  if (!full || !fs.existsSync(full) || !fs.statSync(full).isFile()) return null;
  fs.unlinkSync(full);
  const clean = relPath.replace(/^\/+/, '');
  removeVaultCacheFile(clean);
  return { deleted: true, path: clean };
}

export function deleteDir(relPath) {
  if (!relPath || isProtectedPath(relPath)) return null;
  const clean = String(relPath).replace(/^\/+|\/+$/g, '');
  if (!clean) return null;
  const full = resolveSafe(clean);
  if (!full || full === getVaultRoot() || !fs.existsSync(full) || !fs.statSync(full).isDirectory()) {
    return null;
  }
  fs.rmSync(full, { recursive: true, force: false });
  invalidateVaultCache();
  return { deleted: true, path: clean };
}

export function renameNote(oldPath, newPath) {
  if (!oldPath || !newPath || isProtectedPath(oldPath) || isProtectedPath(newPath)) {
    return { error: 'Invalid or protected path' };
  }
  const cleanOld = oldPath.replace(/^\/+/, '');
  const cleanNew = newPath.replace(/^\/+/, '');
  const srcFull = resolveSafe(cleanOld);
  const dstFull = resolveSafe(cleanNew);
  if (!srcFull || !dstFull || srcFull === getVaultRoot() || dstFull === getVaultRoot()) {
    return { error: 'Invalid path' };
  }
  if (!fs.existsSync(srcFull) || !fs.statSync(srcFull).isFile()) {
    return { error: 'Source file not found' };
  }
  if (fs.existsSync(dstFull)) {
    return { error: 'Destination already exists' };
  }
  fs.mkdirSync(path.dirname(dstFull), { recursive: true });
  fs.renameSync(srcFull, dstFull);
  removeVaultCacheFile(cleanOld);
  updateVaultCacheFile(cleanNew);
  return { ok: true, oldPath: cleanOld, newPath: cleanNew };
}

export function renameDir(oldPath, newPath) {
  if (!oldPath || !newPath || isProtectedPath(oldPath) || isProtectedPath(newPath)) {
    return { error: 'Invalid or protected path' };
  }
  const cleanOld = oldPath.replace(/^\/+|\/+$/g, '');
  const cleanNew = newPath.replace(/^\/+|\/+$/g, '');
  if (!cleanOld || !cleanNew) {
    return { error: 'Invalid path' };
  }
  const srcFull = resolveSafe(cleanOld);
  const dstFull = resolveSafe(cleanNew);
  if (!srcFull || !dstFull || srcFull === getVaultRoot() || dstFull === getVaultRoot()) {
    return { error: 'Invalid path' };
  }
  if (!fs.existsSync(srcFull) || !fs.statSync(srcFull).isDirectory()) {
    return { error: 'Source folder not found' };
  }
  if (dstFull === srcFull || dstFull.startsWith(srcFull + path.sep)) {
    return { error: 'Cannot move a folder into itself' };
  }
  if (fs.existsSync(dstFull)) {
    return { error: 'Destination already exists' };
  }
  fs.mkdirSync(path.dirname(dstFull), { recursive: true });
  fs.renameSync(srcFull, dstFull);
  invalidateVaultCache();
  return { ok: true, oldPath: cleanOld, newPath: cleanNew };
}

export function writeBinaryFile(relPath, buffer) {
  if (!relPath || isProtectedPath(relPath)) return null;
  const clean = relPath.replace(/^\/+/, '');
  const full = resolveSafe(clean);
  if (!full || full === getVaultRoot()) return null;
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, buffer);
  updateVaultCacheFile(clean);
  return { path: clean, bytes: buffer.length };
}

export function createDir(relPath) {
  const clean = typeof relPath === 'string' ? relPath.trim().replace(/^\/+|\/+$/g, '') : '';
  if (!clean || isProtectedPath(clean)) return { error: 'Invalid folder path' };
  const full = resolveSafe(clean);
  if (!full || full === getVaultRoot()) return { error: 'Invalid folder path' };
  if (fs.existsSync(full)) {
    if (fs.statSync(full).isDirectory()) return { error: 'Folder already exists' };
    return { error: 'A file already exists at that path' };
  }
  fs.mkdirSync(full, { recursive: true });
  invalidateVaultCache();
  return { ok: true, path: clean };
}
