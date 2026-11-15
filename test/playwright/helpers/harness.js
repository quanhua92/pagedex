import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';

const REPO_ROOT = path.resolve(import.meta.dirname, '../../..');

function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

async function waitForHealth(baseUrl) {
  for (let i = 0; i < 40; i += 1) {
    try {
      const res = await fetch(`${baseUrl}/api/v1/health`);
      if (res.ok) return;
    } catch {
      // retry until server binds
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Pagedex test server did not become healthy at ${baseUrl}`);
}

export async function createPlaywrightVault(seedFiles = {}) {
  const vaultDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pagedex-pw-'));
  const indexPath = `${vaultDir}.db`;

  for (const [relPath, content] of Object.entries(seedFiles)) {
    const fullPath = path.join(vaultDir, relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf8');
  }

  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const proc = spawn('node', [path.join(REPO_ROOT, 'src/server/index.js')], {
    env: {
      ...process.env,
      PORT: String(port),
      HOST: '127.0.0.1',
      PAGEDEX_ROOT: vaultDir,
      PAGEDEX_INDEX_PATH: indexPath
    },
    stdio: 'pipe'
  });

  await waitForHealth(baseUrl);
  const browser = await chromium.launch({ headless: true });

  async function openAppPage(route = '/') {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));
    await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
    return { context, page, pageErrors };
  }

  async function cleanup() {
    await browser.close().catch(() => {});
    proc.kill('SIGTERM');
    fs.rmSync(vaultDir, { recursive: true, force: true });
    fs.rmSync(indexPath, { force: true });
    fs.rmSync(`${indexPath}-wal`, { force: true });
    fs.rmSync(`${indexPath}-shm`, { force: true });
  }

  return { vaultDir, baseUrl, browser, openAppPage, cleanup };
}
