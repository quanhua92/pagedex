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
  -p, --port <port>          Port to listen on (default: 4321, or PORT env)
  -H, --host <host>          Host to bind (default: 127.0.0.1, or HOST env; use 0.0.0.0 for LAN)
  -o, --open                 Open browser after starting
  --mcp <mode>               MCP mode: read, write, full (default), or off (or PAGEDEX_MCP_MODE)
  --mcp-git                  Enable MCP git_commit and git_discard tools (or PAGEDEX_MCP_GIT=1)
  --mcp-token-file <path>    File containing comma-separated Bearer tokens for /mcp (or PAGEDEX_MCP_TOKEN_FILE)
  --auth-token-file <path>   File containing comma-separated tokens for Web & REST auth (or PAGEDEX_AUTH_TOKEN_FILE)
  --read-only                Disable all REST & MCP write/delete mutations (or PAGEDEX_READ_ONLY=1)
  -v, --version              Show version
  -h, --help                 Show this help
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
let mcpMode = process.env.PAGEDEX_MCP_MODE || 'full';
let mcpGit = process.env.PAGEDEX_MCP_GIT === '1' || process.env.PAGEDEX_MCP_GIT === 'true';
let mcpTokenFile = process.env.PAGEDEX_MCP_TOKEN_FILE || '';
let authTokenFile = process.env.PAGEDEX_AUTH_TOKEN_FILE || '';
let readOnly = process.env.PAGEDEX_READ_ONLY === '1' || process.env.PAGEDEX_READ_ONLY === 'true';

const VALID_MCP_MODES = new Set(['read', 'write', 'full', 'off']);

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
  if (arg === '--read-only') {
    readOnly = true;
    continue;
  }
  if (arg === '--mcp-git') {
    mcpGit = true;
    continue;
  }
  if (arg === '--mcp') {
    mcpMode = (args[++i] || '').toLowerCase();
    if (!VALID_MCP_MODES.has(mcpMode)) {
      console.error(`Invalid --mcp mode: ${mcpMode || '(missing)'}. Expected: read, write, full, or off`);
      process.exit(1);
    }
    continue;
  }
  if (arg.startsWith('--mcp=')) {
    mcpMode = arg.slice('--mcp='.length).toLowerCase();
    if (!VALID_MCP_MODES.has(mcpMode)) {
      console.error(`Invalid --mcp mode: ${mcpMode || '(missing)'}. Expected: read, write, full, or off`);
      process.exit(1);
    }
    continue;
  }
  if (arg === '--mcp-token-file') {
    mcpTokenFile = args[++i];
    if (!mcpTokenFile) {
      console.error('Missing value for --mcp-token-file');
      process.exit(1);
    }
    continue;
  }
  if (arg.startsWith('--mcp-token-file=')) {
    mcpTokenFile = arg.slice('--mcp-token-file='.length);
    if (!mcpTokenFile) {
      console.error('Missing value for --mcp-token-file');
      process.exit(1);
    }
    continue;
  }
  if (arg === '--auth-token-file') {
    authTokenFile = args[++i];
    if (!authTokenFile) {
      console.error('Missing value for --auth-token-file');
      process.exit(1);
    }
    continue;
  }
  if (arg.startsWith('--auth-token-file=')) {
    authTokenFile = arg.slice('--auth-token-file='.length);
    if (!authTokenFile) {
      console.error('Missing value for --auth-token-file');
      process.exit(1);
    }
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

if (!VALID_MCP_MODES.has(mcpMode.toLowerCase())) {
  console.error(`Invalid PAGEDEX_MCP_MODE: ${mcpMode}. Expected: read, write, full, or off`);
  process.exit(1);
}

if (mcpTokenFile) {
  const resolvedTokenFile = path.resolve(mcpTokenFile);
  if (!fs.existsSync(resolvedTokenFile) || !fs.statSync(resolvedTokenFile).isFile()) {
    console.error(`MCP token file not found: ${resolvedTokenFile}`);
    process.exit(1);
  }
  mcpTokenFile = resolvedTokenFile;
}

if (authTokenFile) {
  const resolvedAuthFile = path.resolve(authTokenFile);
  if (!fs.existsSync(resolvedAuthFile) || !fs.statSync(resolvedAuthFile).isFile()) {
    console.error(`Auth token file not found: ${resolvedAuthFile}`);
    process.exit(1);
  }
  authTokenFile = resolvedAuthFile;
}

process.env.PAGEDEX_ROOT = resolvedRoot;
process.env.VAULT_ROOT = resolvedRoot;
process.env.PORT = String(port);
process.env.HOST = String(host);
process.env.PAGEDEX_MCP_MODE = mcpMode.toLowerCase();
if (mcpGit) process.env.PAGEDEX_MCP_GIT = '1';
if (mcpTokenFile) process.env.PAGEDEX_MCP_TOKEN_FILE = mcpTokenFile;
if (authTokenFile) process.env.PAGEDEX_AUTH_TOKEN_FILE = authTokenFile;
if (readOnly) process.env.PAGEDEX_READ_ONLY = '1';

await import('../src/server/index.js');

if (shouldOpen) {
  const openHost = host === '0.0.0.0' || host === '::' ? '127.0.0.1' : host;
  openBrowser(`http://${openHost}:${port}`);
}
