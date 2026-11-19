import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const PORT = 4596;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const CLI_PATH = path.resolve(import.meta.dirname, '../bin/pagedex.js');

async function waitForServer(url, timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/api/v1/auth/status`);
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('Timed out waiting for multi-vault server');
}

function extractCookie(setCookieHeaders, name) {
  const arr = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders].filter(Boolean);
  for (const raw of arr) {
    const first = raw.split(';')[0];
    if (first.startsWith(`${name}=`)) return first;
  }
  return '';
}

test('PAGEDEX_ROOT_CONFIG supports multi-vault, allowGlobalAuth, per-vault tokens, readOnly, and auto-reload', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pagedex-multi-'));
  const personalDir = path.join(tmpDir, 'personal');
  const workDir = path.join(tmpDir, 'work');
  const docsDir = path.join(tmpDir, 'docs');
  const notesDir = path.join(tmpDir, 'notes');
  fs.mkdirSync(personalDir, { recursive: true });
  fs.mkdirSync(workDir, { recursive: true });
  fs.mkdirSync(docsDir, { recursive: true });
  fs.mkdirSync(notesDir, { recursive: true });

  fs.writeFileSync(path.join(personalDir, 'README.md'), '# Personal Vault\n');
  fs.writeFileSync(path.join(workDir, 'secret.md'), '# Work Secret\n');
  fs.writeFileSync(path.join(docsDir, 'guide.md'), '# Docs Guide\n');
  fs.writeFileSync(path.join(notesDir, 'new.md'), '# Reloaded Vault\n');

  const globalAuthFile = path.join(tmpDir, 'global-auth');
  const workAuthFile = path.join(tmpDir, 'work-auth');
  fs.writeFileSync(globalAuthFile, 'global-secret-123\n');
  fs.writeFileSync(workAuthFile, 'work-secret-456\n');

  const configFile = path.join(tmpDir, 'vaults.json');
  const initialConfig = {
    default: 'personal',
    vaults: {
      personal: { root: personalDir, allowGlobalAuth: true },
      work: { root: workDir, authTokenFile: workAuthFile, allowGlobalAuth: false },
      docs: { root: docsDir, readOnly: true, allowGlobalAuth: true }
    }
  };
  fs.writeFileSync(configFile, JSON.stringify(initialConfig, null, 2));

  const proc = spawn(
    process.execPath,
    [CLI_PATH, '--port', String(PORT), '--config', configFile, '--auth-token-file', globalAuthFile],
    {
      env: {
        ...process.env,
        PAGEDEX_INDEX_DIR: path.join(tmpDir, 'index-cache')
      },
      stdio: ['ignore', 'pipe', 'pipe']
    }
  );

  t.after(() => {
    proc.kill('SIGTERM');
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  await waitForServer(BASE_URL);

  // 1. Unauthenticated access is blocked
  const unauthRes = await fetch(`${BASE_URL}/api/v1/tree`);
  assert.equal(unauthRes.status, 401);

  // 2. Global token unlocks personal + docs, but NOT work (allowGlobalAuth: false)
  const loginGlobal = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: 'global-secret-123' })
  });
  assert.equal(loginGlobal.status, 200);
  const globalData = await loginGlobal.json();
  assert.equal(globalData.vault, 'personal');

  const globalCookies = loginGlobal.headers.getSetCookie?.() || [loginGlobal.headers.get('set-cookie')];
  const globalAuthCookie = extractCookie(globalCookies, 'pagedex_auth');
  assert.ok(globalAuthCookie);

  const vaultsRes = await fetch(`${BASE_URL}/api/v1/vaults`, {
    headers: { Cookie: globalAuthCookie }
  });
  const vaultsData = await vaultsRes.json();
  assert.deepEqual(
    vaultsData.vaults.map((v) => v.id),
    ['personal', 'work', 'docs']
  );

  // Global token cannot access isolated work vault
  const workDenied = await fetch(`${BASE_URL}/api/v1/tree?vault=work`, {
    headers: { Cookie: globalAuthCookie }
  });
  assert.equal(workDenied.status, 401);

  const selectWorkDenied = await fetch(`${BASE_URL}/api/v1/vault/select`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: globalAuthCookie },
    body: JSON.stringify({ vault: 'work' })
  });
  assert.equal(selectWorkDenied.status, 401);

  // 3. Per-vault readOnly enforcement (docs is read-only, personal is writable)
  const writeDocs = await fetch(`${BASE_URL}/api/v1/file?vault=docs`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: globalAuthCookie },
    body: JSON.stringify({ path: 'blocked.md', content: 'nope' })
  });
  assert.equal(writeDocs.status, 403);

  // Switching out of a readOnly vault via POST /api/v1/vault/select must still work
  const switchFromDocs = await fetch(`${BASE_URL}/api/v1/vault/select`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `${globalAuthCookie}; pagedex_vault=docs` },
    body: JSON.stringify({ vault: 'personal' })
  });
  assert.equal(switchFromDocs.status, 200);

  const writePersonal = await fetch(`${BASE_URL}/api/v1/file?vault=personal`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: globalAuthCookie },
    body: JSON.stringify({ path: 'created.md', content: 'ok' })
  });
  assert.equal(writePersonal.status, 200);
  assert.equal(fs.readFileSync(path.join(personalDir, 'created.md'), 'utf8'), 'ok');

  // 4. Work token logs directly into work vault and cannot access personal
  const loginWork = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: 'work-secret-456' })
  });
  assert.equal(loginWork.status, 200);
  const workLoginData = await loginWork.json();
  assert.equal(workLoginData.vault, 'work');

  const workCookies = loginWork.headers.getSetCookie?.() || [loginWork.headers.get('set-cookie')];
  const workAuthCookie = extractCookie(workCookies, 'pagedex_auth');
  const workVaultCookie = extractCookie(workCookies, 'pagedex_vault');
  assert.ok(workAuthCookie);

  const workTreeRes = await fetch(`${BASE_URL}/api/v1/tree`, {
    headers: { Cookie: `${workAuthCookie}; ${workVaultCookie}` }
  });
  assert.equal(workTreeRes.status, 200);
  const workTree = await workTreeRes.json();
  assert.ok(workTree.flatFiles.includes('secret.md'));

  const personalDenied = await fetch(`${BASE_URL}/api/v1/tree?vault=personal`, {
    headers: { Cookie: workAuthCookie }
  });
  assert.equal(personalDenied.status, 401);

  // 5. Auto-reload: editing vaults.json adds "notes" vault without restart
  const updatedConfig = {
    ...initialConfig,
    vaults: {
      ...initialConfig.vaults,
      notes: { root: notesDir, allowGlobalAuth: true }
    }
  };
  await new Promise((r) => setTimeout(r, 50));
  fs.writeFileSync(configFile, JSON.stringify(updatedConfig, null, 2));

  let reloaded = false;
  const deadline = Date.now() + 4000;
  while (Date.now() < deadline) {
    const res = await fetch(`${BASE_URL}/api/v1/tree?vault=notes`, {
      headers: { Cookie: globalAuthCookie }
    });
    if (res.ok) {
      const data = await res.json();
      if (data.flatFiles.includes('new.md')) {
        reloaded = true;
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  assert.ok(reloaded, 'Expected vaults.json reload to expose new "notes" vault');
});
