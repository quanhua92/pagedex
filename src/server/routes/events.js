import fs from 'node:fs';
import path from 'node:path';
import { streamSSE } from 'hono/streaming';
import { IGNORED, invalidateVaultCache, updateVaultCacheFile } from '../vault.js';
import { upsertFileInIndex } from '../search-index.js';
import { getActiveVault, listVaults, vaultStorage } from '../vault-manager.js';

export function startVaultWatcher(vault = getActiveVault()) {
  if (!vault || vault.watcher) return;
  try {
    vault.watcher = fs.watch(vault.root, { recursive: true }, (_event, filename) => {
      vaultStorage.run(vault, () => {
        if (filename) {
          const parts = filename.split(path.sep);
          if (parts.some((p) => IGNORED.has(p))) return;
          vault.lastChanged = parts.join('/');
          updateVaultCacheFile(vault.lastChanged);
          try {
            upsertFileInIndex(vault.lastChanged);
          } catch {
            // Ignore transient watch update error
          }
        } else {
          invalidateVaultCache();
        }
        clearTimeout(vault.watchTimer);
        vault.watchTimer = setTimeout(() => {
          for (const send of vault.subscribers) send(vault.lastChanged);
        }, 100);
      });
    });
  } catch (err) {
    console.warn(`fs.watch warning (${vault.id}):`, err.message);
  }
}

export function startAllVaultWatchers() {
  for (const v of listVaults()) {
    startVaultWatcher(v);
  }
}

export function registerEventRoutes(app) {
  app.get('/api/v1/events', (c) => {
    const vault = getActiveVault();
    return streamSSE(c, async (stream) => {
      await stream.writeSSE({ data: JSON.stringify({ type: 'connected', vault: vault.id }) });
      const notify = (changedPath) => {
        stream.writeSSE({ data: JSON.stringify({ type: 'reload', path: changedPath }) }).catch(() => {});
      };
      vault.subscribers.add(notify);
      const keepAlive = setInterval(() => {
        stream.writeSSE({ data: JSON.stringify({ type: 'ping' }) }).catch(() => {});
      }, 25000);
      await new Promise((resolve) => {
        c.req.raw.signal.addEventListener('abort', resolve, { once: true });
      });
      clearInterval(keepAlive);
      vault.subscribers.delete(notify);
    });
  });
}
