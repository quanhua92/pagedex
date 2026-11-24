import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function buildInfoPlugin() {
  return {
    name: 'pagedex-build-info',
    closeBundle() {
      const root = import.meta.dirname;
      let version = null;
      let commit = null;
      try {
        version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version || null;
      } catch {}
      try {
        commit =
          execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
            cwd: root,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore']
          }).trim() || null;
      } catch {}
      const outDir = path.join(root, 'dist');
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(
        path.join(outDir, 'build-info.json'),
        `${JSON.stringify({ version, commit, builtAt: new Date().toISOString() }, null, 2)}\n`
      );
    }
  };
}

export default defineConfig({
  root: 'src/client',
  plugins: [react(), buildInfoPlugin()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    proxy: {
      '/api/v1': { target: 'http://127.0.0.1:4321', xfwd: true },
      '/raw': { target: 'http://127.0.0.1:4321', xfwd: true },
      '/mcp': { target: 'http://127.0.0.1:4321', xfwd: true }
    }
  },
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/highlight.js')) {
            return 'vendor-hljs';
          }
          if (
            id.includes('node_modules/markdown-it') ||
            id.includes('node_modules/linkify-it') ||
            id.includes('node_modules/mdurl') ||
            id.includes('node_modules/entities') ||
            id.includes('node_modules/marked')
          ) {
            return 'vendor-markdown';
          }
          if (
            id.includes('node_modules/@tiptap') ||
            id.includes('node_modules/prosemirror') ||
            id.includes('node_modules/tiptap-markdown')
          ) {
            return 'vendor-tiptap';
          }
          if (id.includes('node_modules/react') || id.includes('node_modules/scheduler')) {
            return 'vendor-react';
          }
        }
      }
    }
  }
});
