import path from 'node:path';
import { getActiveVault } from './vault-manager.js';

export const VAULT_ROOT = path.resolve(
  process.env.PAGEDEX_ROOT || process.env.VAULT_ROOT || process.cwd()
);

export function getVaultRoot() {
  return getActiveVault()?.root || VAULT_ROOT;
}

export const IGNORED = new Set([
  '.git',
  '.gitignore',
  'node_modules',
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  '.venv',
  '__pycache__',
  '.obsidian',
  '.DS_Store',
  'dist',
  '.vault-index.db',
  '.vault-index.db-wal',
  '.vault-index.db-shm',
  '.pagedex-index.db',
  '.pagedex-index.db-wal',
  '.pagedex-index.db-shm'
]);

export const IMAGE_MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

export const MIME_TYPES = {
  ...IMAGE_MIME,
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.tsv': 'text/tab-separated-values; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.markdown': 'text/markdown; charset=utf-8',
  '.mdx': 'text/markdown; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.yaml': 'text/yaml; charset=utf-8',
  '.yml': 'text/yaml; charset=utf-8',
  '.wasm': 'application/wasm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.pdf': 'application/pdf',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime'
};

export function isImagePath(p) {
  return /\.(png|jpe?g|gif|webp|svg|ico)$/i.test(p);
}

export function resolveSafe(relPath) {
  const root = getVaultRoot();
  const cleaned = String(relPath || '').replace(/^\/+/, '');
  const resolved = path.resolve(root, cleaned);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    return null;
  }
  return resolved;
}

export function isProtectedPath(relPath) {
  const parts = String(relPath || '').replace(/^\/+/, '').split('/');
  return parts.some((p) => p === '.git' || p === 'node_modules' || p === 'dist');
}
