import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__e2e__/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    globalSetup: ['src/__e2e__/setup/global-setup.ts'],
    pool: 'forks',
    fileParallelism: false,
  },
});
