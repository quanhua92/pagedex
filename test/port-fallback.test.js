import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const CLI_ENTRY = path.resolve(import.meta.dirname, '../bin/pagedex.js');

function listenDummy(port) {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once('error', reject);
    srv.listen(port, '127.0.0.1', () => resolve(srv));
  });
}

function closeServer(srv) {
  return new Promise((resolve) => srv.close(() => resolve()));
}

function runCli(args, env = {}) {
  const proc = spawn('node', ['--no-warnings', CLI_ENTRY, ...args], {
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  return proc;
}

test('falls back to random port when default 4321 is busy and no -p is given', async () => {
  const tmpVault = fs.mkdtempSync(path.join(os.tmpdir(), 'pagedex-port-fallback-'));
  fs.writeFileSync(path.join(tmpVault, 'README.md'), '# Test\n', 'utf8');

  let blocker = null;
  try {
    blocker = await listenDummy(4321);
  } catch (err) {
    if (err.code !== 'EADDRINUSE') throw err;
  }

  const cleanEnv = { ...process.env };
  delete cleanEnv.PORT;
  delete cleanEnv.PAGEDEX_PORT_FALLBACK;

  const proc = spawn('node', ['--no-warnings', CLI_ENTRY, tmpVault, '--mcp', 'off'], {
    env: cleanEnv,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  try {
    const actualPort = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Server start timeout')), 5000);
      let stdout = '';
      let stderr = '';
      proc.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
        const match = stdout.match(/Pagedex listening on http:\/\/127\.0\.0\.1:(\d+)/);
        if (match) {
          clearTimeout(timer);
          resolve(Number(match[1]));
        }
      });
      proc.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });
      proc.once('exit', (code) => {
        clearTimeout(timer);
        reject(new Error(`CLI exited early (${code}): ${stderr || stdout}`));
      });
    });

    assert.ok(actualPort > 0 && actualPort !== 4321, `Expected random port != 4321, got ${actualPort}`);
    const res = await fetch(`http://127.0.0.1:${actualPort}/api/v1/health`);
    assert.equal(res.status, 200);
  } finally {
    proc.kill('SIGTERM');
    if (blocker) await closeServer(blocker);
    fs.rmSync(tmpVault, { recursive: true, force: true });
  }
});

test('fails with EADDRINUSE when explicit -p port is busy', async () => {
  const tmpVault = fs.mkdtempSync(path.join(os.tmpdir(), 'pagedex-port-explicit-'));
  fs.writeFileSync(path.join(tmpVault, 'README.md'), '# Test\n', 'utf8');

  const blocker = await listenDummy(0);
  const busyPort = blocker.address().port;

  const proc = runCli([tmpVault, '-p', String(busyPort), '--mcp', 'off']);

  try {
    const result = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('CLI exit timeout')), 5000);
      let stderr = '';
      proc.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });
      proc.once('exit', (code) => {
        clearTimeout(timer);
        resolve({ code, stderr });
      });
    });

    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /EADDRINUSE/);
  } finally {
    if (proc.exitCode === null) proc.kill('SIGTERM');
    await closeServer(blocker);
    fs.rmSync(tmpVault, { recursive: true, force: true });
  }
});
