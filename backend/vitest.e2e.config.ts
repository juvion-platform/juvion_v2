import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__e2e__/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    globalSetup: ['src/__e2e__/setup/global-setup.ts'],
    // The by-id scope plugin is a global Mongoose plugin: it must be registered
    // before a test file imports its first model (in production server.ts does this).
    setupFiles: ['src/shared/rbac/scope-plugin.ts'],
    pool: 'forks',
    fileParallelism: false,
  },
});
