import fs from 'node:fs';
import path from 'node:path';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { getCachedVault } from './vault.js';
import { syncIndex } from './search-index.js';
import { handleMcpRequest } from './mcp.js';
import { registerFileRoutes } from './routes/files.js';
import { registerGitRoutes } from './routes/git.js';
import { registerEventRoutes, startVaultWatcher } from './routes/events.js';
import { authMiddleware, registerAuthRoutes } from './auth.js';

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 4321);
const READ_ONLY = process.env.PAGEDEX_READ_ONLY === '1' || process.env.PAGEDEX_READ_ONLY === 'true';

try {
  syncIndex();
  getCachedVault();
} catch (err) {
  console.warn('search index init warning:', err.message);
}

startVaultWatcher();

const app = new Hono();

app.use('/api/v1/*', authMiddleware);

app.use('/api/v1/*', async (c, next) => {
  const method = c.req.method.toUpperCase();
  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
    if (READ_ONLY) {
      return c.json({ error: 'Server is running in read-only mode' }, 403);
    }
    if (c.req.header('origin') === 'null') {
      return c.json({ error: 'Forbidden origin' }, 403);
    }
  }
  await next();
});

registerAuthRoutes(app);
registerFileRoutes(app);
registerGitRoutes(app);
registerEventRoutes(app);

// MCP endpoint (Streamable HTTP)
app.all('/mcp', (c) => handleMcpRequest(c.req.raw));

// Serve built React app in production (dist/)
const distDir = path.resolve(import.meta.dirname, '../../dist');
if (fs.existsSync(distDir)) {
  const relDist = path.relative(process.cwd(), distDir) || '.';
  app.use('/*', serveStatic({ root: relDist }));
}

serve({ fetch: app.fetch, hostname: HOST, port: PORT }, () => {
  console.log(`Pagedex listening on http://${HOST}:${PORT} (root: ${process.env.PAGEDEX_ROOT || process.env.VAULT_ROOT || process.cwd()})`);
});
