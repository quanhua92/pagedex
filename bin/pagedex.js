#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const pkgPath = path.resolve(import.meta.dirname, '../package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

function printHelp() {
  console.log(`pagedex v${pkg.version}

Usage:
  pagedex [dir] [options]

Arguments:
  dir                 Directory to serve (defaults to current working directory)

Options:
  -p, --port <port>   Port to listen on (default: 4321, or PORT env)
  -H, --host <host>   Host to bind (default: 127.0.0.1, or HOST env; use 0.0.0.0 for LAN)
  -o, --open          Open browser after starting
  -v, --version       Show version
  -h, --help          Show this help
`);
}

function openBrowser(url) {
  const cmd =
    process.platform === 'darwin'
      ? ['open', [url]]
      : process.platform === 'win32'
        ? ['cmd', ['/c', 'start', '', url]]
        : ['xdg-open', [url]];
  const child = spawn(cmd[0], cmd[1], { detached: true, stdio: 'ignore' });
  child.unref();
}

const args = process.argv.slice(2);
let targetDir = null;
let port = process.env.PORT || '4321';
let host = process.env.HOST || '127.0.0.1';
let shouldOpen = false;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '-h' || arg === '--help') {
    printHelp();
    process.exit(0);
  }
  if (arg === '-v' || arg === '--version') {
    console.log(pkg.version);
    process.exit(0);
  }
  if (arg === '-o' || arg === '--open') {
    shouldOpen = true;
    continue;
  }
  if (arg === '-p' || arg === '--port') {
    port = args[++i];
    if (!port) {
      console.error('Missing value for --port');
      process.exit(1);
    }
    continue;
  }
  if (arg.startsWith('--port=')) {
    port = arg.slice('--port='.length);
    continue;
  }
  if (arg === '-H' || arg === '--host') {
    host = args[++i];
    if (!host) {
      console.error('Missing value for --host');
      process.exit(1);
    }
    continue;
  }
  if (arg.startsWith('--host=')) {
    host = arg.slice('--host='.length);
    continue;
  }
  if (arg.startsWith('-')) {
    console.error(`Unknown option: ${arg}`);
    printHelp();
    process.exit(1);
  }
  if (!targetDir) {
    targetDir = arg;
  }
}

const resolvedRoot = path.resolve(targetDir || process.env.PAGEDEX_ROOT || process.env.VAULT_ROOT || process.cwd());
if (!fs.existsSync(resolvedRoot) || !fs.statSync(resolvedRoot).isDirectory()) {
  console.error(`Directory not found: ${resolvedRoot}`);
  process.exit(1);
}

process.env.PAGEDEX_ROOT = resolvedRoot;
process.env.VAULT_ROOT = resolvedRoot;
process.env.PORT = String(port);
process.env.HOST = String(host);

await import('../src/server/index.js');

if (shouldOpen) {
  const openHost = host === '0.0.0.0' || host === '::' ? '127.0.0.1' : host;
  openBrowser(`http://${openHost}:${port}`);
}
