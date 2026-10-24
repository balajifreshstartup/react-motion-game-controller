import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts', '**/*.test.tsx'],
    alias: {
      '@motion-game/protocol': path.resolve(__dirname, './packages/protocol/src/index.ts'),
    },
  },
});
