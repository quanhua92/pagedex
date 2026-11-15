import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import {
  Client,
  StreamableHTTPClientTransport,
  SSEClientTransport,
  PROTOCOL_VERSION_META_KEY,
  CLIENT_INFO_META_KEY,
  CLIENT_CAPABILITIES_META_KEY,
  SERVER_INFO_META_KEY
} from '@modelcontextprotocol/client';

const SERVER_ENTRY = path.resolve(import.meta.dirname, '../src/server/index.js');
const mode = process.argv[2] || 'all'; // 'api' | 'mcp' | 'all'

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

async function detectOrSpawnServer() {
  const defaultUrl = process.env.SMOKE_URL || `http://127.0.0.1:${process.env.PORT || 4321}`;
  try {
    const res = await fetch(`${defaultUrl}/api/v1/health`, { signal: AbortSignal.timeout(800) });
    if (res.ok) {
      const json = await res.json();
      if (json && json.ok) {
        return { baseUrl: defaultUrl, live: true, cleanup: () => {} };
      }
    }
  } catch {
    // Live server not running; spawn ephemeral test server
  }

  const tmpVault = fs.mkdtempSync(path.join(os.tmpdir(), 'vault-smoke-'));
  fs.mkdirSync(path.join(tmpVault, 'core'), { recursive: true });
  fs.writeFileSync(path.join(tmpVault, 'README.md'), '# Smoke Test Vault\nHome note.\n', 'utf8');
  fs.writeFileSync(path.join(tmpVault, 'core/a.md'), '# Note A\nLinks to [[README]].\n', 'utf8');

  const port = 4595 + Math.floor(Math.random() * 200);
  const baseUrl = `http://127.0.0.1:${port}`;
  const proc = spawn('node', ['--no-warnings', SERVER_ENTRY], {
    env: { ...process.env, VAULT_ROOT: tmpVault, HOST: '127.0.0.1', PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Server start timeout')), 5000);
    proc.stdout.on('data', (chunk) => {
      if (chunk.toString().includes('listening')) {
        clearTimeout(timer);
        resolve();
      }
    });
    proc.stderr.on('data', (chunk) => {
      clearTimeout(timer);
      reject(new Error(chunk.toString()));
    });
  });

  return {
    baseUrl,
    live: false,
    cleanup: () => {
      proc.kill('SIGTERM');
      fs.rmSync(tmpVault, { recursive: true, force: true });
    }
  };
}

async function mcpCall(baseUrl, method, params = {}, id = 1) {
  const envelopeVersion = params?._meta?.[PROTOCOL_VERSION_META_KEY];
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream'
  };
  if (envelopeVersion) {
    headers['MCP-Protocol-Version'] = envelopeVersion;
    headers['Mcp-Method'] = method;
  }
  const res = await fetch(`${baseUrl}/mcp`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params })
  });
  const raw = await res.text();
  assert.equal(res.status, 200, `Expected HTTP 200 from /mcp, got ${res.status}: ${raw}`);
  const dataLine = raw.split('\n').find((l) => l.startsWith('data: '));
  return JSON.parse(dataLine ? dataLine.slice(6) : raw);
}

async function runSuite(title, checks) {
  console.log(`\n${BOLD}=== ${title} ===${RESET}`);
  let passed = 0;
  let failed = 0;

  for (const { name, fn } of checks) {
    const t0 = performance.now();
    try {
      const detail = await fn();
      const ms = Math.round(performance.now() - t0);
      const suffix = detail ? ` ${DIM}— ${detail}${RESET}` : '';
      console.log(`  ${GREEN}${BOLD}PASS${RESET}  ${name} ${DIM}(${ms}ms)${RESET}${suffix}`);
      passed++;
    } catch (err) {
      const ms = Math.round(performance.now() - t0);
      console.log(`  ${RED}${BOLD}FAIL${RESET}  ${name} ${DIM}(${ms}ms)${RESET} — ${RED}${err.message}${RESET}`);
      failed++;
    }
  }

  return { passed, failed };
}

async function buildApiChecks(baseUrl) {
  const probePath = `__smoke_api_${process.pid}.md`;
  const renamedPath = `__smoke_api_renamed_${process.pid}.md`;

  return [
    {
      name: 'GET /api/v1/health',
      fn: async () => {
        const res = await fetch(`${baseUrl}/api/v1/health`);
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.ok, true);
        return `root=${data.root}`;
      }
    },
    {
      name: 'GET /api/v1/tree',
      fn: async () => {
        const res = await fetch(`${baseUrl}/api/v1/tree?limit=50`);
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.ok(Array.isArray(data.tree));
        assert.ok(Array.isArray(data.flatFiles));
        return `${data.totalFiles} files indexed`;
      }
    },
    {
      name: 'GET /api/v1/files (paginated)',
      fn: async () => {
        const res = await fetch(`${baseUrl}/api/v1/files?sort=mtime&offset=0&limit=5`);
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.ok(Array.isArray(data.items));
        return `returned ${data.items.length}/${data.total} files`;
      }
    },
    {
      name: 'PUT /api/v1/file (create note)',
      fn: async () => {
        const res = await fetch(`${baseUrl}/api/v1/file`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: probePath, content: '# Smoke Probe\nalpha token\n' })
        });
        assert.equal(res.status, 200);
        return probePath;
      }
    },
    {
      name: 'PATCH /api/v1/file (partial edit)',
      fn: async () => {
        const res = await fetch(`${baseUrl}/api/v1/file`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: probePath, target: 'alpha token', replacement: 'omega token' })
        });
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.replacements, 1);
        return '1 replacement';
      }
    },
    {
      name: 'GET /api/v1/file & /api/v1/search (read + FTS)',
      fn: async () => {
        const text = await (await fetch(`${baseUrl}/api/v1/file?path=${encodeURIComponent(probePath)}`)).text();
        assert.ok(text.includes('omega token'));
        const search = await (await fetch(`${baseUrl}/api/v1/search?q=omega`)).json();
        assert.ok(search.results.some((r) => r.path === probePath));
        return 'FTS match verified';
      }
    },
    {
      name: 'POST /api/v1/file/rename & DELETE /api/v1/file',
      fn: async () => {
        const ren = await fetch(`${baseUrl}/api/v1/file/rename`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ oldPath: probePath, newPath: renamedPath })
        });
        assert.equal(ren.status, 200);
        const del = await fetch(`${baseUrl}/api/v1/file?path=${encodeURIComponent(renamedPath)}`, {
          method: 'DELETE'
        });
        assert.equal(del.status, 200);
        return 'cleaned up probe file';
      }
    }
  ];
}

async function buildMcpChecks(baseUrl) {
  const probePath = `__smoke_mcp_${process.pid}.md`;

  return [
    {
      name: 'MCP v2 server/discover (2026-07-28 modern era)',
      fn: async () => {
        const res = await mcpCall(
          baseUrl,
          'server/discover',
          {
            _meta: {
              [PROTOCOL_VERSION_META_KEY]: '2026-07-28',
              [CLIENT_INFO_META_KEY]: { name: 'smoke-modern', version: '0.1.0' },
              [CLIENT_CAPABILITIES_META_KEY]: {}
            }
          },
          1
        );
        assert.equal(res.result._meta[SERVER_INFO_META_KEY].name, 'vault-mcp');
        assert.ok(res.result.supportedVersions.includes('2026-07-28'));
        return `versions=[${res.result.supportedVersions.join(', ')}]`;
      }
    },
    {
      name: 'MCP initialize (2025-11-25 legacy Streamable HTTP)',
      fn: async () => {
        const res = await mcpCall(
          baseUrl,
          'initialize',
          {
            protocolVersion: '2025-11-25',
            capabilities: {},
            clientInfo: { name: 'smoke-test', version: '0.1.0' }
          },
          2
        );
        assert.equal(res.result.serverInfo.name, 'vault-mcp');
        return `${res.result.serverInfo.name}@${res.result.serverInfo.version} (${res.result.protocolVersion})`;
      }
    },
    {
      name: 'MCP tools/list (inputSchema + outputSchema)',
      fn: async () => {
        const res = await mcpCall(baseUrl, 'tools/list', {}, 2);
        const names = res.result.tools.map((t) => t.name);
        for (const expected of ['list_vault', 'read_note', 'search_vault', 'write_note', 'delete_note']) {
          const tool = res.result.tools.find((t) => t.name === expected);
          assert.ok(tool, `Missing tool: ${expected}`);
          assert.ok(tool.outputSchema, `Missing outputSchema on ${expected}`);
        }
        return names.join(', ');
      }
    },
    {
      name: 'MCP tool: write_note (create + edit)',
      fn: async () => {
        const createRes = await mcpCall(
          baseUrl,
          'tools/call',
          {
            name: 'write_note',
            arguments: { path: probePath, content: '# MCP Smoke\nhello mcp\n' }
          },
          3
        );
        assert.ok(!createRes.result.isError);
        assert.equal(createRes.result.structuredContent.path, probePath);

        const editRes = await mcpCall(
          baseUrl,
          'tools/call',
          {
            name: 'write_note',
            arguments: { path: probePath, target: 'hello mcp', replacement: 'verified mcp' }
          },
          4
        );
        assert.ok(!editRes.result.isError);
        assert.equal(editRes.result.structuredContent.replacements, 1);
        return probePath;
      }
    },
    {
      name: 'MCP tool: read_note & search_vault',
      fn: async () => {
        const readRes = await mcpCall(
          baseUrl,
          'tools/call',
          { name: 'read_note', arguments: { path: probePath } },
          5
        );
        assert.ok(!readRes.result.isError);
        assert.ok(readRes.result.structuredContent.content.includes('verified mcp'));

        const searchRes = await mcpCall(
          baseUrl,
          'tools/call',
          { name: 'search_vault', arguments: { query: 'verified mcp', limit: 5 } },
          6
        );
        assert.ok(!searchRes.result.isError);
        assert.ok(searchRes.result.structuredContent.results.some((r) => r.path === probePath));
        return 'read + FTS search verified';
      }
    },
    {
      name: 'MCP tool: list_vault & delete_note',
      fn: async () => {
        const listRes = await mcpCall(baseUrl, 'tools/call', { name: 'list_vault', arguments: {} }, 7);
        assert.ok(!listRes.result.isError);
        const sc = listRes.result.structuredContent;
        assert.ok(Array.isArray(sc.folders));
        assert.ok(sc.files.includes(probePath));

        const delRes = await mcpCall(
          baseUrl,
          'tools/call',
          { name: 'delete_note', arguments: { path: probePath } },
          8
        );
        assert.ok(!delRes.result.isError);
        assert.equal(delRes.result.structuredContent.ok, true);
        return 'cleaned up probe file';
      }
    },
    {
      name: 'Official MCP v2 Client: Modern Era (pin: 2026-07-28)',
      fn: async () => {
        const client = new Client(
          { name: 'sdk-modern-client', version: '0.1.0' },
          { versionNegotiation: { mode: { pin: '2026-07-28' } } }
        );
        const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`));
        await client.connect(transport);
        try {
          const { tools } = await client.listTools();
          assert.equal(tools.length, 5);
          const res = await client.callTool({ name: 'list_vault', arguments: {} });
          assert.ok(res.structuredContent);
          assert.equal(res.structuredContent.folder, '/');
          return 'pinned 2026-07-28 server/discover verified';
        } finally {
          await client.close();
        }
      }
    },
    {
      name: 'Official MCP v2 Client: Auto Negotiation (mode: auto)',
      fn: async () => {
        const client = new Client(
          { name: 'sdk-auto-client', version: '0.1.0' },
          { versionNegotiation: { mode: 'auto' } }
        );
        const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`));
        await client.connect(transport);
        try {
          const { tools } = await client.listTools();
          assert.equal(tools.length, 5);
          const res = await client.callTool({ name: 'list_vault', arguments: {} });
          assert.ok(res.structuredContent);
          assert.equal(res.structuredContent.folder, '/');
          return 'auto-negotiated 2026-07-28 verified';
        } finally {
          await client.close();
        }
      }
    },
    {
      name: 'Official MCP v2 Client: Legacy Streamable HTTP (mode: legacy)',
      fn: async () => {
        const client = new Client(
          { name: 'sdk-legacy-client', version: '0.1.0' },
          { versionNegotiation: { mode: 'legacy' } }
        );
        const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`));
        await client.connect(transport);
        try {
          const { tools } = await client.listTools();
          assert.equal(tools.length, 5);
          const res = await client.callTool({ name: 'list_vault', arguments: {} });
          assert.ok(res.structuredContent);
          assert.equal(res.structuredContent.folder, '/');
          return `protocol=${transport.protocolVersion || '2025-11-25'}`;
        } finally {
          await client.close();
        }
      }
    },
    {
      name: 'Official MCP v2 Client: Legacy HTTP+SSE (2024-11-05 SSEClientTransport)',
      fn: async () => {
        const client = new Client({ name: 'sdk-sse-client', version: '0.1.0' });
        const transport = new SSEClientTransport(new URL(`${baseUrl}/mcp`));
        await client.connect(transport);
        try {
          const { tools } = await client.listTools();
          assert.equal(tools.length, 5);
          const res = await client.callTool({ name: 'list_vault', arguments: {} });
          assert.ok(res.structuredContent);
          assert.equal(res.structuredContent.folder, '/');
          return 'SSE connected & verified';
        } finally {
          await client.close();
        }
      }
    }
  ];
}

const env = await detectOrSpawnServer();
console.log(
  `${DIM}Target: ${env.baseUrl} (${env.live ? 'live server' : 'ephemeral test server'})${RESET}`
);

let totalPassed = 0;
let totalFailed = 0;

try {
  if (mode === 'api' || mode === 'all') {
    const r = await runSuite('REST API Smoke Checks', await buildApiChecks(env.baseUrl));
    totalPassed += r.passed;
    totalFailed += r.failed;
  }
  if (mode === 'mcp' || mode === 'all') {
    const r = await runSuite('MCP Endpoint Smoke Checks', await buildMcpChecks(env.baseUrl));
    totalPassed += r.passed;
    totalFailed += r.failed;
  }
} finally {
  // Best-effort cleanup of probe files if any check failed mid-way on a live server
  for (const leftover of [
    `__smoke_api_${process.pid}.md`,
    `__smoke_api_renamed_${process.pid}.md`,
    `__smoke_mcp_${process.pid}.md`
  ]) {
    await fetch(`${env.baseUrl}/api/v1/file?path=${encodeURIComponent(leftover)}`, {
      method: 'DELETE'
    }).catch(() => {});
  }
  env.cleanup();
}

const total = totalPassed + totalFailed;
if (totalFailed === 0) {
  console.log(`\n${GREEN}${BOLD}RESULT: PASS (${totalPassed}/${total} checks passed)${RESET}\n`);
  process.exit(0);
} else {
  console.log(
    `\n${RED}${BOLD}RESULT: FAILED (${totalPassed}/${total} passed, ${totalFailed} failed)${RESET}\n`
  );
  process.exit(1);
}
