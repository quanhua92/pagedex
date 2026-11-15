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

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 4321);

try {
  syncIndex();
  getCachedVault();
} catch (err) {
  console.warn('search index init warning:', err.message);
}

startVaultWatcher();

const app = new Hono();

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
