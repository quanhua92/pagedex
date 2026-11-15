import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { McpServer, createMcpHandler, parseJSONRPCMessage } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { deleteNote, editNote, getCachedVault, resolveSafe, writeNote } from './vault.js';
import { removeFileFromIndex, searchFts, upsertFileInIndex } from './search-index.js';

const sseSessions = new Map();
const encoder = new TextEncoder();

class WebStandardSSEServerTransport {
  constructor(endpoint = '/mcp') {
    this.endpoint = endpoint;
    this.sessionId = randomUUID();
    this._controller = null;
    this.onmessage = undefined;
    this.onclose = undefined;
    this.onerror = undefined;
  }

  async start() {
    // Stream is initialized in createResponse()
  }

  createResponse(signal) {
    const stream = new ReadableStream({
      start: (controller) => {
        this._controller = controller;
        const endpointUri = `${this.endpoint}?sessionId=${this.sessionId}`;
        controller.enqueue(encoder.encode(`event: endpoint\ndata: ${endpointUri}\n\n`));
      },
      cancel: () => {
        this.close();
      }
    });

    signal?.addEventListener('abort', () => this.close(), { once: true });

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no'
      }
    });
  }

  async send(message) {
    if (!this._controller) return;
    try {
      this._controller.enqueue(encoder.encode(`event: message\ndata: ${JSON.stringify(message)}\n\n`));
    } catch (err) {
      this.onerror?.(err);
    }
  }

  async handlePostMessage(req) {
    let body;
    try {
      body = await req.json();
    } catch (err) {
      this.onerror?.(err);
      return new Response('Invalid JSON', { status: 400 });
    }
    try {
      const parsed = parseJSONRPCMessage(body);
      this.onmessage?.(parsed);
    } catch (err) {
      this.onerror?.(err);
      return new Response('Invalid JSON-RPC message', { status: 400 });
    }
    return new Response('Accepted', { status: 202 });
  }

  async close() {
    if (!this._controller) return;
    const ctrl = this._controller;
    this._controller = null;
    sseSessions.delete(this.sessionId);
    try {
      ctrl.close();
    } catch {
      // already closed
    }
    this.onclose?.();
  }
}

function createVaultMcpServer() {
  const server = new McpServer({
    name: 'vault-mcp',
    version: '0.1.0'
  });

  server.registerTool(
    'list_vault',
    {
      title: 'List Vault Directory',
      description:
        'List immediate folders and files in a vault directory (like ls). Leave folder empty for root "/", or pass a folder path (e.g. "core", "backups/2026") to drill down.',
      inputSchema: z.object({
        folder: z.string().optional()
      }),
      outputSchema: z.object({
        folder: z.string(),
        folders: z.array(z.string()),
        files: z.array(z.string())
      })
    },
    async ({ folder }) => {
      const { tree } = getCachedVault();
      const cleanFolder = (folder || '').trim().replace(/^\/+|\/+$/g, '');

      let nodes = tree;
      if (cleanFolder) {
        for (const segment of cleanFolder.split('/')) {
          const dirNode = nodes.find((n) => n.type === 'dir' && n.name === segment);
          if (!dirNode) {
            return {
              isError: true,
              content: [{ type: 'text', text: `Folder not found: ${cleanFolder}` }]
            };
          }
          nodes = dirNode.children || [];
        }
      }

      const folders = nodes.filter((n) => n.type === 'dir').map((n) => `${n.path}/`);
      const files = nodes.filter((n) => n.type === 'file').map((n) => n.path);
      const lines = [
        ...folders.map((d) => `[DIR]  ${d}`),
        ...files.map((f) => `[FILE] ${f}`)
      ];

      return {
        structuredContent: {
          folder: cleanFolder || '/',
          folders,
          files
        },
        content: [
          {
            type: 'text',
            text: lines.length ? lines.join('\n') : '(empty directory)'
          }
        ]
      };
    }
  );

  server.registerTool(
    'read_note',
    {
      title: 'Read Note',
      description: 'Read a file or note from the vault by relative path, including incoming backlinks.',
      inputSchema: z.object({
        path: z.string()
      }),
      outputSchema: z.object({
        path: z.string(),
        backlinks: z.array(z.string()),
        content: z.string()
      })
    },
    async ({ path: relPath }) => {
      const full = resolveSafe(relPath);
      if (!full || !fs.existsSync(full) || !fs.statSync(full).isFile()) {
        return { isError: true, content: [{ type: 'text', text: `Not found: ${relPath}` }] };
      }
      const content = fs.readFileSync(full, 'utf8');
      const { backlinks } = getCachedVault();
      const bl = backlinks[relPath] || [];
      return {
        structuredContent: {
          path: relPath,
          backlinks: bl,
          content
        },
        content: [
          {
            type: 'text',
            text: `# ${relPath}\nBacklinks: ${bl.length ? bl.join(', ') : 'none'}\n\n${content}`
          }
        ]
      };
    }
  );

  server.registerTool(
    'search_vault',
    {
      title: 'Search Vault',
      description: 'Search across vault filenames and note contents.',
      inputSchema: z.object({
        query: z.string(),
        limit: z.number().int().min(1).max(50).optional()
      }),
      outputSchema: z.object({
        query: z.string(),
        count: z.number(),
        results: z.array(
          z.object({
            path: z.string(),
            mtimeMs: z.number(),
            snippet: z.string()
          })
        )
      })
    },
    async ({ query, limit }) => {
      const hits = searchFts(query, limit ?? 20).map((h) => ({
        path: h.path,
        mtimeMs: h.mtimeMs,
        snippet: (h.snippet || '').replace(/\s+/g, ' ').trim()
      }));
      const lines = hits.map((h) => (h.snippet ? `${h.path} — ${h.snippet}` : h.path));
      return {
        structuredContent: {
          query,
          count: hits.length,
          results: hits
        },
        content: [
          {
            type: 'text',
            text: lines.length ? lines.join('\n') : `No matches found for: ${query}`
          }
        ]
      };
    }
  );

  server.registerTool(
    'write_note',
    {
      title: 'Write or Edit Note',
      description:
        'Create/overwrite/append a note (with content), or partially edit an existing note (with target + replacement).',
      inputSchema: z.object({
        path: z.string(),
        content: z.string().optional(),
        append: z.boolean().optional(),
        target: z.string().optional(),
        replacement: z.string().optional(),
        replaceAll: z.boolean().optional()
      }),
      outputSchema: z.object({
        ok: z.boolean(),
        path: z.string(),
        mode: z.enum(['write', 'append', 'edit']),
        bytes: z.number().optional(),
        replacements: z.number().optional()
      })
    },
    async ({ path: relPath, content, append, target, replacement, replaceAll }) => {
      if (typeof target === 'string' && typeof replacement === 'string') {
        const result = editNote(relPath, target, replacement, { replaceAll: Boolean(replaceAll) });
        if (result.error) {
          return { isError: true, content: [{ type: 'text', text: result.error }] };
        }
        upsertFileInIndex(result.path);
        return {
          structuredContent: {
            ok: true,
            path: result.path,
            mode: 'edit',
            replacements: result.replacements
          },
          content: [
            {
              type: 'text',
              text: `Edited ${result.path} (${result.replacements} replacement${result.replacements === 1 ? '' : 's'})`
            }
          ]
        };
      }
      if (typeof content !== 'string') {
        return { isError: true, content: [{ type: 'text', text: 'Provide either content or target + replacement' }] };
      }
      const result = writeNote(relPath, content, { append: Boolean(append) });
      if (!result) {
        return { isError: true, content: [{ type: 'text', text: `Invalid or protected path: ${relPath}` }] };
      }
      upsertFileInIndex(result.path);
      return {
        structuredContent: {
          ok: true,
          path: result.path,
          mode: append ? 'append' : 'write',
          bytes: result.bytes
        },
        content: [
          {
            type: 'text',
            text: `${append ? 'Appended' : 'Wrote'} ${result.path} (${result.bytes} bytes)`
          }
        ]
      };
    }
  );

  server.registerTool(
    'delete_note',
    {
      title: 'Delete Note',
      description: 'Delete a note/file from the vault by relative path.',
      inputSchema: z.object({
        path: z.string()
      }),
      outputSchema: z.object({
        ok: z.boolean(),
        path: z.string()
      })
    },
    async ({ path: relPath }) => {
      const result = deleteNote(relPath);
      if (!result) {
        return { isError: true, content: [{ type: 'text', text: `Not found or protected path: ${relPath}` }] };
      }
      removeFileFromIndex(result.path);
      return {
        structuredContent: {
          ok: true,
          path: result.path
        },
        content: [{ type: 'text', text: `Deleted ${result.path}` }]
      };
    }
  );

  return server;
}

const mcpHandler = createMcpHandler(createVaultMcpServer);

export async function handleMcpRequest(req) {
  const url = new URL(req.url, 'http://localhost');
  const sessionId = url.searchParams.get('sessionId');
  const isStreamableHttpGet =
    req.headers.has('mcp-protocol-version') || req.headers.has('mcp-session-id');

  // 1. Legacy HTTP+SSE (2024-11-05): GET /mcp (without Streamable HTTP headers) establishes SSE stream
  if (req.method === 'GET' && !sessionId && !isStreamableHttpGet) {
    const transport = new WebStandardSSEServerTransport(url.pathname);
    sseSessions.set(transport.sessionId, transport);
    const server = createVaultMcpServer();
    await server.connect(transport);
    return transport.createResponse(req.signal);
  }

  // 2. Legacy HTTP+SSE: POST /mcp?sessionId=<uuid> delivers JSON-RPC message to active SSE session
  if (req.method === 'POST' && sessionId) {
    const transport = sseSessions.get(sessionId);
    if (!transport) {
      return new Response('Session not found', { status: 404 });
    }
    return transport.handlePostMessage(req);
  }

  // 3. Official MCP v2 handler: supports BOTH Modern (2026-07-28 server/discover) and Legacy Streamable HTTP (2025-11-25 initialize)
  return mcpHandler.fetch(req);
}
