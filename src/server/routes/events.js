import fs from 'node:fs';
import path from 'node:path';
import { streamSSE } from 'hono/streaming';
import { IGNORED, VAULT_ROOT, invalidateVaultCache, updateVaultCacheFile } from '../vault.js';
import { upsertFileInIndex } from '../search-index.js';

const subscribers = new Set();
let watchTimer = null;
let lastChanged = '';

export function startVaultWatcher() {
  try {
    fs.watch(VAULT_ROOT, { recursive: true }, (_event, filename) => {
      if (filename) {
        const parts = filename.split(path.sep);
        if (parts.some((p) => IGNORED.has(p))) return;
        lastChanged = parts.join('/');
        updateVaultCacheFile(lastChanged);
        try {
          upsertFileInIndex(lastChanged);
        } catch {
          // Ignore transient watch update error
        }
      } else {
        invalidateVaultCache();
      }
      clearTimeout(watchTimer);
      watchTimer = setTimeout(() => {
        for (const send of subscribers) send(lastChanged);
      }, 100);
    });
  } catch (err) {
    console.warn('fs.watch warning:', err.message);
  }
}

export function registerEventRoutes(app) {
  app.get('/api/v1/events', (c) => {
    return streamSSE(c, async (stream) => {
      await stream.writeSSE({ data: JSON.stringify({ type: 'connected' }) });
      const notify = (changedPath) => {
        stream.writeSSE({ data: JSON.stringify({ type: 'reload', path: changedPath }) }).catch(() => {});
      };
      subscribers.add(notify);
      const keepAlive = setInterval(() => {
        stream.writeSSE({ data: JSON.stringify({ type: 'ping' }) }).catch(() => {});
      }, 25000);
      await new Promise((resolve) => {
        c.req.raw.signal.addEventListener('abort', resolve, { once: true });
      });
      clearInterval(keepAlive);
      subscribers.delete(notify);
    });
  });
}
