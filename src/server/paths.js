import path from 'node:path';

export const VAULT_ROOT = path.resolve(
  process.env.PAGEDEX_ROOT || process.env.VAULT_ROOT || process.cwd()
);

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

export function isImagePath(p) {
  return /\.(png|jpe?g|gif|webp|svg|ico)$/i.test(p);
}

export function resolveSafe(relPath) {
  const cleaned = String(relPath || '').replace(/^\/+/, '');
  const resolved = path.resolve(VAULT_ROOT, cleaned);
  if (resolved !== VAULT_ROOT && !resolved.startsWith(VAULT_ROOT + path.sep)) {
    return null;
  }
  return resolved;
}

export function isProtectedPath(relPath) {
  const parts = String(relPath || '').replace(/^\/+/, '').split('/');
  return parts.some((p) => p === '.git' || p === 'node_modules' || p === 'dist');
}
