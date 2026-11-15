import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'src/client',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    proxy: {
      '/api/v1': 'http://127.0.0.1:4321',
      '/mcp': 'http://127.0.0.1:4321'
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
