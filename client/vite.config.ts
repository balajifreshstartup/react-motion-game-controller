import path from 'node:path';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), basicSsl()],
  resolve: {
    alias: {
      '@motion-game/protocol': path.resolve(__dirname, '../packages/protocol/src/index.ts'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/ws': {
        target: 'ws://localhost:8080',
        ws: true,
        rewrite: (p) => p.replace(/^\/ws/, ''),
      },
    },
  },
  assetsInclude: ['**/*.task', '**/*.wasm'],
});
