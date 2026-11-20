import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const SERVER_ENTRY = path.resolve(import.meta.dirname, '../src/server/index.js');
let BASE = '';

let tmpVault;
let serverProc;

async function mcpCall(method, params = {}, id = 1) {
  const envelopeVersion = params?._meta?.['io.modelcontextprotocol/protocolVersion'];
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream'
  };
  if (envelopeVersion) {
    headers['MCP-Protocol-Version'] = envelopeVersion;
    headers['Mcp-Method'] = method;
  }
  const res = await fetch(`${BASE}/mcp`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params })
  });
  assert.equal(res.status, 200);
  const raw = await res.text();
  const dataLine = raw
    .split('\n')
    .find((l) => l.startsWith('data: '));
  return JSON.parse(dataLine ? dataLine.slice(6) : raw);
}

function waitForListeningPort(proc, timeoutMs = 5000) {
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
      () => finish(reject, new Error(`Server start timeout${stderr ? `: ${stderr.trim()}` : ''}`)),
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
      finish(reject, new Error(`Server exited early (${code}): ${stderr.trim() || stdout.trim()}`));
    });
  });
}

test.before(async () => {
  tmpVault = fs.mkdtempSync(path.join(os.tmpdir(), 'vault-test-'));
  fs.mkdirSync(path.join(tmpVault, 'core'), { recursive: true });
  fs.writeFileSync(path.join(tmpVault, 'README.md'), '# Test Vault\nHome note.\n', 'utf8');
  fs.writeFileSync(path.join(tmpVault, 'core/a.md'), '# Note A\nLinks to [[README]].\n', 'utf8');

  serverProc = spawn('node', ['--no-warnings', SERVER_ENTRY], {
    env: { ...process.env, VAULT_ROOT: tmpVault, HOST: '127.0.0.1', PORT: '0' },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  const port = await waitForListeningPort(serverProc);
  BASE = `http://127.0.0.1:${port}`;
});

test.after(() => {
  serverProc?.kill('SIGTERM');
  if (tmpVault && fs.existsSync(tmpVault)) {
    fs.rmSync(tmpVault, { recursive: true, force: true });
  }
});

test('REST health, tree, backlinks, and search', async () => {
  const health = await (await fetch(`${BASE}/api/v1/health`)).json();
  assert.equal(health.ok, true);
  assert.equal(health.root, tmpVault);

  const tree = await (await fetch(`${BASE}/api/v1/tree?limit=10000`)).json();
  assert.ok(tree.flatFiles.includes('README.md'));
  assert.ok(tree.flatFiles.includes('core/a.md'));
  assert.ok(Array.isArray(tree.fileStats) && tree.fileStats.length === tree.totalFiles);
  assert.equal(typeof tree.fileStats[0].mtimeMs, 'number');
  assert.equal(tree.truncated, false);
  assert.deepEqual(tree.backlinks['README.md'], ['core/a.md']);

  const limitedTree = await (await fetch(`${BASE}/api/v1/tree?limit=1`)).json();
  assert.equal(limitedTree.fileStats.length, 1);
  assert.equal(limitedTree.truncated, true);

  const mtimeTree = await (await fetch(`${BASE}/api/v1/tree?sort=mtime`)).json();
  assert.ok(mtimeTree.tree.length >= 2);
  assert.equal(typeof mtimeTree.tree[0].mtimeMs, 'number');

  const nameTree = await (await fetch(`${BASE}/api/v1/tree?sort=name`)).json();
  assert.ok(nameTree.fileStats.length >= 2);

  const search = await (await fetch(`${BASE}/api/v1/search?q=Home`)).json();
  assert.ok(search.results.some((r) => r.path === 'README.md'));

  const shortSearch = await (await fetch(`${BASE}/api/v1/search?q=Ho`)).json();
  assert.ok(shortSearch.results.some((r) => r.path === 'README.md'));

  const paged1 = await (await fetch(`${BASE}/api/v1/files?sort=name&offset=0&limit=1`)).json();
  assert.equal(paged1.items.length, 1);
  assert.equal(paged1.hasMore, true);
  assert.equal(paged1.total, tree.totalFiles);

  const paged2 = await (await fetch(`${BASE}/api/v1/files?sort=mtime&offset=1&limit=10`)).json();
  assert.equal(paged2.items.length, tree.totalFiles - 1);
  assert.equal(paged2.hasMore, false);

  const changes = await (await fetch(`${BASE}/api/v1/changes`)).json();
  assert.equal(changes.isGit, false);
  assert.deepEqual(changes.changes, []);

  const badCommit = await fetch(`${BASE}/api/v1/git/commit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: '   ' })
  });
  assert.equal(badCommit.status, 400);
});

test('REST write, append, partial edit, delete, and path guards', async () => {
  const putRes = await fetch(`${BASE}/api/v1/file`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: 'inbox/note.md', content: '# Draft\nhello world\n' })
  });
  assert.equal(putRes.status, 200);

  const appendRes = await fetch(`${BASE}/api/v1/file`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: 'inbox/note.md', content: 'second line\n', append: true })
  });
  assert.equal(appendRes.status, 200);

  const patchRes = await fetch(`${BASE}/api/v1/file`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: 'inbox/note.md', target: 'hello world', replacement: 'hello vault' })
  });
  assert.equal(patchRes.status, 200);
  const patchJson = await patchRes.json();
  assert.equal(patchJson.replacements, 1);

  const text = await (await fetch(`${BASE}/api/v1/file?path=inbox/note.md`)).text();
  assert.equal(text, '# Draft\nhello vault\nsecond line\n');

  const renRes = await fetch(`${BASE}/api/v1/file/rename`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ oldPath: 'inbox/note.md', newPath: 'inbox/renamed.md' })
  });
  assert.equal(renRes.status, 200);

  const delRes = await fetch(`${BASE}/api/v1/file?path=inbox/renamed.md`, { method: 'DELETE' });
  assert.equal(delRes.status, 200);

  // Multipart upload into folder + folder rename
  const form = new FormData();
  form.append('dir', 'inbox/upload-dir');
  form.append('files', new Blob(['uploaded content\n'], { type: 'text/markdown' }), 'uploaded.md');
  const upRes = await fetch(`${BASE}/api/v1/file/upload`, { method: 'POST', body: form });
  assert.equal(upRes.status, 200);
  const upJson = await upRes.json();
  assert.equal(upJson.uploaded[0].path, 'inbox/upload-dir/uploaded.md');

  const dirRenRes = await fetch(`${BASE}/api/v1/dir/rename`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ oldPath: 'inbox/upload-dir', newPath: 'inbox/renamed-dir' })
  });
  assert.equal(dirRenRes.status, 200);

  const movedRead = await fetch(`${BASE}/api/v1/file?path=inbox/renamed-dir/uploaded.md`);
  assert.equal(await movedRead.text(), 'uploaded content\n');
  await fetch(`${BASE}/api/v1/file?path=inbox/renamed-dir/uploaded.md`, { method: 'DELETE' });
  const afterDelTree = await (await fetch(`${BASE}/api/v1/tree`)).json();
  assert.ok(!afterDelTree.flatFiles.includes('inbox/renamed-dir/uploaded.md'));
  const hasFileInTree = (nodes, target) =>
    nodes.some((n) => (n.type === 'file' ? n.path === target : hasFileInTree(n.children || [], target)));
  assert.equal(hasFileInTree(afterDelTree.tree, 'inbox/renamed-dir/uploaded.md'), false);
  fs.rmdirSync(path.join(tmpVault, 'inbox/renamed-dir'));

  // Path traversal & protected path guards
  const trav = await fetch(`${BASE}/api/v1/file?path=../etc/passwd`);
  assert.equal(trav.status, 404);
  const prot = await fetch(`${BASE}/api/v1/file`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: '.git/config', content: 'bad' })
  });
  assert.equal(prot.status, 400);
});

test('MCP server/discover (2026-07-28), initialize (2025-11-25), tools/list, and full CRUD tools', async () => {
  const discover = await mcpCall('server/discover', {
    _meta: {
      'io.modelcontextprotocol/protocolVersion': '2026-07-28',
      'io.modelcontextprotocol/clientInfo': { name: 'test-modern', version: '0.1.0' },
      'io.modelcontextprotocol/clientCapabilities': {}
    }
  }, 0);
  assert.ok(discover.result.supportedVersions.includes('2026-07-28'));
  assert.equal(discover.result._meta['io.modelcontextprotocol/serverInfo'].name, 'vault-mcp');

  const init = await mcpCall('initialize', {
    protocolVersion: '2025-11-25',
    capabilities: {},
    clientInfo: { name: 'test', version: '0.1.0' }
  }, 1);
  assert.equal(init.result.serverInfo.name, 'vault-mcp');

  const list = await mcpCall('tools/list', {}, 2);
  const names = list.result.tools.map((t) => t.name);
  for (const expected of ['list_vault', 'read_note', 'search_vault', 'write_note', 'delete_note']) {
    assert.ok(names.includes(expected), `Missing tool: ${expected}`);
  }

  const writeRes = await mcpCall('tools/call', {
    name: 'write_note',
    arguments: { path: 'inbox/mcp.md', content: '# MCP\nalpha beta\n' }
  }, 3);
  assert.ok(!writeRes.result.isError);

  const editRes = await mcpCall('tools/call', {
    name: 'write_note',
    arguments: { path: 'inbox/mcp.md', target: 'alpha beta', replacement: 'gamma delta' }
  }, 4);
  assert.ok(!editRes.result.isError);

  const readRes = await mcpCall('tools/call', {
    name: 'read_note',
    arguments: { path: 'inbox/mcp.md' }
  }, 5);
  assert.ok(readRes.result.content[0].text.includes('gamma delta'));

  const delRes = await mcpCall('tools/call', {
    name: 'delete_note',
    arguments: { path: 'inbox/mcp.md' }
  }, 6);
  assert.ok(!delRes.result.isError);
});

test('Git diff and single-line / file discard', async () => {
  const { execFileSync } = await import('node:child_process');
  const gitVault = fs.mkdtempSync(path.join(os.tmpdir(), 'vault-git-test-'));
  execFileSync('git', ['init'], { cwd: gitVault });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: gitVault });
  execFileSync('git', ['config', 'user.name', 'Tester'], { cwd: gitVault });
  fs.writeFileSync(path.join(gitVault, 'note.md'), 'alpha\nbeta\ngamma\n', 'utf8');
  execFileSync('git', ['add', '.'], { cwd: gitVault });
  execFileSync('git', ['commit', '-m', 'init'], { cwd: gitVault });
  fs.writeFileSync(path.join(gitVault, 'note.md'), 'alpha\nbeta-edited\ngamma\ndelta', 'utf8');

  const proc = spawn('node', [SERVER_ENTRY], {
    env: { ...process.env, VAULT_ROOT: gitVault, HOST: '127.0.0.1', PORT: '0' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const gPort = await waitForListeningPort(proc);
  const gBase = `http://127.0.0.1:${gPort}`;

  try {
    const diff = await (await fetch(`${gBase}/api/v1/git/diff?path=note.md`)).json();
    assert.equal(diff.hunks.length, 1);
    const addIdx = diff.hunks[0].lines.findIndex((l) => l.type === 'add' && l.text === 'delta');
    assert.ok(addIdx >= 0);

    const lineDisc = await fetch(`${gBase}/api/v1/git/discard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: 'note.md', hunkIndex: 0, lineIndex: addIdx })
    });
    assert.equal(lineDisc.status, 200);
    assert.equal(fs.readFileSync(path.join(gitVault, 'note.md'), 'utf8'), 'alpha\nbeta-edited\ngamma');

    const fileDisc = await fetch(`${gBase}/api/v1/git/discard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: 'note.md' })
    });
    assert.equal(fileDisc.status, 200);
    assert.equal(fs.readFileSync(path.join(gitVault, 'note.md'), 'utf8'), 'alpha\nbeta\ngamma\n');
  } finally {
    proc.kill('SIGTERM');
    fs.rmSync(gitVault, { recursive: true, force: true });
  }
});

test('Raw route, CSP/CORS, Origin: null guard, and Range requests', async () => {
  const htmlDir = path.join(tmpVault, 'viz');
  fs.mkdirSync(htmlDir, { recursive: true });
  fs.writeFileSync(path.join(htmlDir, 'index.html'), '<script>fetch("data.json")</script>');
  fs.writeFileSync(path.join(htmlDir, 'data.json'), '{"ok":true}');
  fs.writeFileSync(path.join(tmpVault, '.env'), 'SECRET=123');
  fs.writeFileSync(path.join(tmpVault, 'sample.mp3'), '0123456789');

  const htmlRes = await fetch(`${BASE}/raw/viz/index.html`);
  assert.equal(htmlRes.status, 200);
  assert.match(htmlRes.headers.get('content-type') || '', /text\/html/);
  assert.equal(htmlRes.headers.get('access-control-allow-origin'), '*');
  assert.match(
    htmlRes.headers.get('content-security-policy') || '',
    new RegExp(`default-src ${BASE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)
  );

  const dataRes = await fetch(`${BASE}/raw/viz/data.json`);
  assert.equal(dataRes.status, 200);
  assert.match(dataRes.headers.get('content-type') || '', /application\/json/);
  assert.equal(dataRes.headers.get('access-control-allow-origin'), '*');
  assert.equal(await dataRes.text(), '{"ok":true}');

  const envRes = await fetch(`${BASE}/raw/.env`);
  assert.equal(envRes.status, 404);
  const gitRes = await fetch(`${BASE}/raw/.git/config`);
  assert.equal(gitRes.status, 404);

  const nullOriginPost = await fetch(`${BASE}/api/v1/file`, {
    method: 'POST',
    headers: { Origin: 'null', 'Content-Type': 'text/plain' },
    body: JSON.stringify({ path: 'inbox/pwn.md', content: 'bad' })
  });
  assert.equal(nullOriginPost.status, 403);

  const rangeRes = await fetch(`${BASE}/api/v1/file?path=sample.mp3`, {
    headers: { Range: 'bytes=2-5' }
  });
  assert.equal(rangeRes.status, 206);
  assert.match(rangeRes.headers.get('content-type') || '', /audio\/mpeg/);
  assert.equal(rangeRes.headers.get('content-range'), 'bytes 2-5/10');
  assert.equal(await rangeRes.text(), '2345');
});
