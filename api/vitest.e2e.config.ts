import { defineConfig } from 'vitest/config';

// Tests de bout en bout (test/*.e2e-spec.ts) : l'API compilée sur une base dédiée.
//   pnpm --filter @visa/api test:e2e
export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    globalSetup: ['test/preparation-e2e.ts'],
    // Une seule API et une seule base : les fichiers passent l'un après l'autre.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
