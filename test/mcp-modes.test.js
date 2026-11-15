import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';

const BIN_ENTRY = path.resolve(import.meta.dirname, '../bin/pagedex.js');

async function startCliServer(vaultDir, cliArgs, port) {
  const proc = spawn('node', ['--no-warnings', BIN_ENTRY, vaultDir, '--port', String(port), ...cliArgs], {
    env: { ...process.env, PAGEDEX_INDEX_PATH: `${vaultDir}.db` },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('CLI server start timeout')), 5000);
    proc.stdout.on('data', (chunk) => {
      if (chunk.toString().includes('listening')) {
        clearTimeout(timer);
        resolve();
      }
    });
    proc.stderr.on('data', (chunk) => {
      const msg = chunk.toString();
      if (msg.toLowerCase().includes('error')) {
        clearTimeout(timer);
        reject(new Error(msg));
      }
    });
    proc.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`CLI exited early with code ${code}`));
    });
  });

  return proc;
}

async function mcpPost(baseUrl, method, params = {}, token = null, id = 1) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream'
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}/mcp`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params })
  });
  const raw = await res.text();
  const dataLine = raw.split('\n').find((l) => l.startsWith('data: '));
  return {
    status: res.status,
    body: dataLine ? JSON.parse(dataLine.slice(6)) : JSON.parse(raw)
  };
}

function makeTempVault() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pagedex-mcp-modes-'));
  fs.mkdirSync(path.join(dir, 'core'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'README.md'), '# Home\n\nWelcome.\n', 'utf8');
  fs.writeFileSync(path.join(dir, 'core/a.md'), '# Note A\n\n## Details\nSee [[README]].\n', 'utf8');
  return dir;
}

test('CLI --mcp read + --mcp-token-file enforces Bearer auth and exposes read tools including new info/links tools', async () => {
  const vaultDir = makeTempVault();
  const tokenFile = path.join(os.tmpdir(), `pagedex-tok-${Date.now()}.txt`);
  fs.writeFileSync(tokenFile, 'secret-token-123\n', 'utf8');
  const port = 4592;
  const baseUrl = `http://127.0.0.1:${port}`;
  const proc = await startCliServer(vaultDir, ['--mcp', 'read', '--mcp-token-file', tokenFile], port);

  try {
    const unauth = await mcpPost(baseUrl, 'tools/list', {});
    assert.equal(unauth.status, 401);

    const listRes = await mcpPost(baseUrl, 'tools/list', {}, 'secret-token-123');
    assert.equal(listRes.status, 200);
    const names = listRes.body.result.tools.map((t) => t.name).sort();
    assert.deepEqual(names, [
      'get_note_links',
      'get_vault_info',
      'git_diff',
      'git_status',
      'list_vault',
      'read_note',
      'search_vault'
    ]);

    const infoRes = await mcpPost(
      baseUrl,
      'tools/call',
      { name: 'get_vault_info', arguments: { recentLimit: 5 } },
      'secret-token-123',
      2
    );
    assert.equal(infoRes.body.result.structuredContent.totalFiles, 2);

    const linksRes = await mcpPost(
      baseUrl,
      'tools/call',
      { name: 'get_note_links', arguments: { path: 'core/a.md' } },
      'secret-token-123',
      3
    );
    assert.deepEqual(linksRes.body.result.structuredContent.outgoingLinks, ['README']);
    assert.deepEqual(linksRes.body.result.structuredContent.headings, [
      { level: 1, text: 'Note A' },
      { level: 2, text: 'Details' }
    ]);
  } finally {
    proc.kill();
    fs.rmSync(vaultDir, { recursive: true, force: true });
    fs.rmSync(`${vaultDir}.db`, { force: true });
    fs.rmSync(tokenFile, { force: true });
  }
});

test('CLI --mcp write --mcp-git allows move_path and git tools without exposing delete_note', async () => {
  const vaultDir = makeTempVault();
  execFileSync('git', ['init'], { cwd: vaultDir });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: vaultDir });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: vaultDir });
  execFileSync('git', ['add', '-A'], { cwd: vaultDir });
  execFileSync('git', ['commit', '-m', 'init'], { cwd: vaultDir });

  const port = 4593;
  const baseUrl = `http://127.0.0.1:${port}`;
  const proc = await startCliServer(vaultDir, ['--mcp', 'write', '--mcp-git'], port);

  try {
    const listRes = await mcpPost(baseUrl, 'tools/list', {});
    const names = listRes.body.result.tools.map((t) => t.name);
    assert.ok(names.includes('write_note'));
    assert.ok(names.includes('move_path'));
    assert.ok(names.includes('git_commit'));
    assert.ok(names.includes('git_discard'));
    assert.equal(names.includes('delete_note'), false);

    // Move core/a.md -> core/moved.md
    const moveRes = await mcpPost(baseUrl, 'tools/call', {
      name: 'move_path',
      arguments: { oldPath: 'core/a.md', newPath: 'core/moved.md' }
    });
    assert.equal(moveRes.body.result.structuredContent.ok, true);
    assert.equal(fs.existsSync(path.join(vaultDir, 'core/a.md')), false);
    assert.equal(fs.existsSync(path.join(vaultDir, 'core/moved.md')), true);

    // Git status + commit
    const statusRes = await mcpPost(baseUrl, 'tools/call', {
      name: 'git_status',
      arguments: {}
    });
    assert.ok(statusRes.body.result.structuredContent.count >= 1);

    const commitRes = await mcpPost(baseUrl, 'tools/call', {
      name: 'git_commit',
      arguments: { message: 'move note via mcp' }
    });
    assert.equal(commitRes.body.result.structuredContent.ok, true);

    // Modify README.md, inspect git_diff, then git_discard
    fs.writeFileSync(path.join(vaultDir, 'README.md'), '# Home\n\nModified.\n', 'utf8');
    const diffRes = await mcpPost(baseUrl, 'tools/call', {
      name: 'git_diff',
      arguments: { path: 'README.md' }
    });
    assert.match(diffRes.body.result.structuredContent.raw, /\+Modified\./);

    const discardRes = await mcpPost(baseUrl, 'tools/call', {
      name: 'git_discard',
      arguments: { path: 'README.md' }
    });
    assert.equal(discardRes.body.result.structuredContent.ok, true);
    assert.equal(fs.readFileSync(path.join(vaultDir, 'README.md'), 'utf8'), '# Home\n\nWelcome.\n');
  } finally {
    proc.kill();
    fs.rmSync(vaultDir, { recursive: true, force: true });
    fs.rmSync(`${vaultDir}.db`, { force: true });
  }
});

test('CLI --read-only blocks REST writes and restricts MCP to read tools; --mcp off returns 404', async () => {
  const vaultDir = makeTempVault();
  const roPort = 4594;
  const roBase = `http://127.0.0.1:${roPort}`;
  const roProc = await startCliServer(vaultDir, ['--read-only'], roPort);

  try {
    const putRes = await fetch(`${roBase}/api/v1/file`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: 'blocked.md', content: 'nope' })
    });
    assert.equal(putRes.status, 403);

    const listRes = await mcpPost(roBase, 'tools/list', {});
    const names = listRes.body.result.tools.map((t) => t.name);
    assert.equal(names.includes('write_note'), false);
    assert.equal(names.includes('delete_note'), false);
    assert.ok(names.includes('read_note'));
  } finally {
    roProc.kill();
  }

  const offPort = 4595;
  const offBase = `http://127.0.0.1:${offPort}`;
  const offProc = await startCliServer(vaultDir, ['--mcp', 'off'], offPort);

  try {
    const offRes = await mcpPost(offBase, 'tools/list', {});
    assert.equal(offRes.status, 404);
  } finally {
    offProc.kill();
    fs.rmSync(vaultDir, { recursive: true, force: true });
    fs.rmSync(`${vaultDir}.db`, { force: true });
  }
});
