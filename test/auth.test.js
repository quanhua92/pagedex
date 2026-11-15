import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';

const PORT = 4597;
const BASE = `http://127.0.0.1:${PORT}`;

let tmpVault;
let authTokenFile;
let mcpTokenFile;
let serverProc;

async function waitForServer(url, timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/api/v1/auth/status`);
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('Timed out waiting for server');
}

before(async () => {
  tmpVault = fs.mkdtempSync(path.join(os.tmpdir(), 'pagedex-auth-test-'));
  fs.writeFileSync(path.join(tmpVault, 'README.md'), '# Secret Vault\nHello.\n', 'utf8');
  authTokenFile = path.join(tmpVault, '.auth-tokens');
  mcpTokenFile = path.join(tmpVault, '.mcp-token');
  fs.writeFileSync(authTokenFile, 'alpha-key, beta-key\n', 'utf8');
  fs.writeFileSync(mcpTokenFile, 'mcp-only-secret\n', 'utf8');

  serverProc = spawn(
    process.execPath,
    [
      'bin/pagedex.js',
      tmpVault,
      '--port',
      String(PORT),
      '--host',
      '127.0.0.1',
      '--auth-token-file',
      authTokenFile,
      '--mcp-token-file',
      mcpTokenFile
    ],
    {
      cwd: path.resolve(import.meta.dirname, '..'),
      stdio: 'ignore'
    }
  );
  await waitForServer(BASE);
});

after(() => {
  if (serverProc && !serverProc.killed) serverProc.kill('SIGTERM');
  if (tmpVault && fs.existsSync(tmpVault)) {
    fs.rmSync(tmpVault, { recursive: true, force: true });
  }
});

test('auth-token-file locks REST endpoints, supports cookie login, key rotation, and keeps MCP separate', async () => {
  // 1. Status is public and reports required: true, authenticated: false
  const status0 = await fetch(`${BASE}/api/v1/auth/status`).then((r) => r.json());
  assert.deepEqual(status0, { required: true, authenticated: false });

  // 2. REST endpoints reject unauthenticated requests
  for (const ep of ['/api/v1/health', '/api/v1/tree', '/api/v1/file?path=README.md', '/api/v1/search?q=Secret']) {
    const res = await fetch(`${BASE}${ep}`);
    assert.equal(res.status, 401, `Expected 401 on ${ep}`);
  }

  // 3. Invalid login rejected
  const badLogin = await fetch(`${BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: 'wrong-key' })
  });
  assert.equal(badLogin.status, 401);

  // 4. Valid login with alpha-key sets HttpOnly cookie
  const goodLogin = await fetch(`${BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: 'alpha-key' })
  });
  assert.equal(goodLogin.status, 200);
  const setCookie = goodLogin.headers.get('set-cookie') || '';
  assert.match(setCookie, /pagedex_auth=/);
  assert.match(setCookie, /HttpOnly/i);
  const cookieHeader = setCookie.split(';')[0];

  // 5. Cookie grants access to REST endpoints
  const treeRes = await fetch(`${BASE}/api/v1/tree`, { headers: { Cookie: cookieHeader } });
  assert.equal(treeRes.status, 200);
  const status1 = await fetch(`${BASE}/api/v1/auth/status`, { headers: { Cookie: cookieHeader } }).then((r) =>
    r.json()
  );
  assert.deepEqual(status1, { required: true, authenticated: true });

  // 6. Bearer header works for REST with beta-key
  const bearerRes = await fetch(`${BASE}/api/v1/file?path=README.md`, {
    headers: { Authorization: 'Bearer beta-key' }
  });
  assert.equal(bearerRes.status, 200);

  // 7. Key rotation: remove alpha-key, keep beta-key -> alpha-key cookie & bearer immediately fail
  fs.writeFileSync(authTokenFile, 'beta-key, gamma-key\n', 'utf8');
  const rotatedCookieRes = await fetch(`${BASE}/api/v1/tree`, { headers: { Cookie: cookieHeader } });
  assert.equal(rotatedCookieRes.status, 401);
  const rotatedBearerRes = await fetch(`${BASE}/api/v1/tree`, {
    headers: { Authorization: 'Bearer alpha-key' }
  });
  assert.equal(rotatedBearerRes.status, 401);
  const newKeyRes = await fetch(`${BASE}/api/v1/tree`, {
    headers: { Authorization: 'Bearer gamma-key' }
  });
  assert.equal(newKeyRes.status, 200);

  // 8. MCP stays governed strictly by --mcp-token-file
  const mcpWithAuthToken = await fetch(`${BASE}/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer beta-key'
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' })
  });
  assert.equal(mcpWithAuthToken.status, 401);

  const restWithMcpToken = await fetch(`${BASE}/api/v1/tree`, {
    headers: { Authorization: 'Bearer mcp-only-secret' }
  });
  assert.equal(restWithMcpToken.status, 401);

  // 9. Empty auth-token-file fails closed
  fs.writeFileSync(authTokenFile, '   \n', 'utf8');
  const emptyFileRes = await fetch(`${BASE}/api/v1/tree`, {
    headers: { Authorization: 'Bearer beta-key' }
  });
  assert.equal(emptyFileRes.status, 401);
});
