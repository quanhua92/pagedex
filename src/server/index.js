import fs from 'node:fs';
import path from 'node:path';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { getCachedVault } from './vault.js';
import { closeVaultSearchIndex, syncIndex } from './search-index.js';
import { handleMcpRequest } from './mcp.js';
import { registerFileRoutes } from './routes/files.js';
import { registerGitRoutes } from './routes/git.js';
import { registerEventRoutes, startAllVaultWatchers, startVaultWatcher } from './routes/events.js';
import { authMiddleware, parseVaultCookie, registerAuthRoutes } from './auth.js';
import {
  getActiveVault,
  getDefaultVault,
  getVault,
  initVaultManager,
  isMultiVault,
  isVaultReadOnly,
  listVaults,
  vaultStorage
} from './vault-manager.js';

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 4321);

function initVaultRuntime(vault) {
  try {
    vaultStorage.run(vault, () => {
      syncIndex();
      getCachedVault();
    });
  } catch (err) {
    console.warn(`search index init warning (${vault.id}):`, err.message);
  }
  startVaultWatcher(vault);
}

initVaultManager({
  onVaultAdded: initVaultRuntime,
  onVaultRemoved: (vault) => closeVaultSearchIndex(vault)
});

startAllVaultWatchers();

const app = new Hono();

async function resolveVaultMiddleware(c, next) {
  const requestedId =
    c.req.query('vault') ||
    c.req.header('x-pagedex-vault') ||
    parseVaultCookie(c.req.header('cookie') || '');
  const vault = (requestedId && getVault(requestedId)) || getDefaultVault();
  return vaultStorage.run(vault, () => next());
}

app.use('/api/v1/*', resolveVaultMiddleware);
app.use('/raw/*', resolveVaultMiddleware);
app.use('/mcp', resolveVaultMiddleware);

app.use('/api/v1/*', authMiddleware);

app.use('/api/v1/*', async (c, next) => {
  const method = c.req.method.toUpperCase();
  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
    const reqPath = c.req.path;
    const isSessionRoute =
      reqPath === '/api/v1/auth/login' || reqPath === '/api/v1/auth/logout' || reqPath === '/api/v1/vault/select';
    if (!isSessionRoute && isVaultReadOnly(getActiveVault())) {
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
  app.use('/sw.js', async (c, next) => {
    await next();
    c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  });
  app.use('/*', serveStatic({ root: relDist }));
}

serve({ fetch: app.fetch, hostname: HOST, port: PORT }, () => {
  const summary = isMultiVault()
    ? `${listVaults().length} vaults: ${listVaults().map((v) => v.id).join(', ')}`
    : `root: ${getDefaultVault()?.root || process.cwd()}`;
  console.log(`Pagedex listening on http://${HOST}:${PORT} (${summary})`);
});
