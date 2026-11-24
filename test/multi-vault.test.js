import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';

const CLI_PATH = path.resolve(import.meta.dirname, '../bin/pagedex.js');

function waitForListeningPort(proc, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let stdout = '';
    let stderr = '';
    const finish = (fn, val) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(val);
    };
    const timer = setTimeout(
      () => finish(reject, new Error(`Timed out waiting for multi-vault server${stderr ? `: ${stderr.trim()}` : ''}`)),
      timeoutMs
    );
    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
      const match = stdout.match(/Pagedex listening on http:\/\/[^:\s]+:(\d+)/);
      if (match) finish(resolve, Number(match[1]));
    });
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    proc.once('exit', (code) => {
      finish(reject, new Error(`Multi-vault server exited early (${code}): ${stderr.trim() || stdout.trim()}`));
    });
  });
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
    [CLI_PATH, '--port', '0', '--config', configFile, '--auth-token-file', globalAuthFile],
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

  const port = await waitForListeningPort(proc);
  const BASE_URL = `http://127.0.0.1:${port}`;

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

test('Git changes and commit scope paths relative to nested subdirectory vault', async (t) => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pagedex-subgit-'));
  const vault2027 = path.join(repoRoot, '2027', 'zelda');
  const siblingDir = path.join(repoRoot, 'other');
  fs.mkdirSync(vault2027, { recursive: true });
  fs.mkdirSync(siblingDir, { recursive: true });

  execFileSync('git', ['init'], { cwd: repoRoot });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: repoRoot });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: repoRoot });

  fs.writeFileSync(path.join(repoRoot, 'README.md'), '# Repo\n');
  execFileSync('git', ['add', '.'], { cwd: repoRoot });
  execFileSync('git', ['commit', '-m', 'init'], { cwd: repoRoot });

  const targetFile = path.join(vault2027, '01-the-master-sword-trials.md');
  const siblingFile = path.join(siblingDir, 'unrelated.md');
  fs.writeFileSync(targetFile, '# Trials\n');
  fs.writeFileSync(siblingFile, '# Sibling\n');

  const proc = spawn('node', [CLI_PATH, path.join(repoRoot, '2027'), '-p', '0', '--mcp', 'off'], {
    env: { ...process.env, PAGEDEX_INDEX_PATH: `${repoRoot}.db` },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  t.after(() => {
    proc.kill('SIGTERM');
    fs.rmSync(repoRoot, { recursive: true, force: true });
    fs.rmSync(`${repoRoot}.db`, { force: true });
  });

  const port = await waitForListeningPort(proc);
  const baseUrl = `http://127.0.0.1:${port}`;

  const changesRes = await fetch(`${baseUrl}/api/v1/changes`);
  assert.equal(changesRes.status, 200);
  const changesData = await changesRes.json();
  assert.equal(changesData.isGit, true);
  assert.deepEqual(
    changesData.changes.map((c) => c.path),
    ['zelda/01-the-master-sword-trials.md']
  );
  assert.ok(changesData.changes[0].mtimeMs > 0);

  const commitRes = await fetch(`${baseUrl}/api/v1/git/commit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'Add trial note',
      files: ['zelda/01-the-master-sword-trials.md']
    })
  });
  assert.equal(commitRes.status, 200);
  const commitData = await commitRes.json();
  assert.equal(commitData.ok, true);

  const postStatus = execFileSync('git', ['status', '--porcelain'], { cwd: repoRoot, encoding: 'utf8' });
  assert.match(postStatus, /other\//);
  assert.doesNotMatch(postStatus, /01-the-master-sword-trials\.md/);
});
