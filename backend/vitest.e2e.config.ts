import { defineConfig } from 'vitest/config';
import { E2E_WORKERS } from './src/__e2e__/setup/workers';

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
    // Files run in parallel; each worker has its own MongoDB server (see setup/global-setup.ts).
    pool: 'forks',
    maxWorkers: E2E_WORKERS,
  },
});
