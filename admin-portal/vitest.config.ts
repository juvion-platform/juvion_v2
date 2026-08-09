/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * Frontend test config for the admin-portal.
 *
 * Mirrors the backend's vitest layout — tests live alongside source under
 * `__tests__` directories (`src/**\/__tests__/**\/*.test.{ts,tsx}`). React
 * components are rendered against jsdom; @testing-library/jest-dom matchers
 * are auto-loaded via the setup file below.
 *
 *   npm test -w admin-portal             // single run
 *   npm test:watch -w admin-portal       // file-watching mode
 *   npm test:coverage -w admin-portal    // with v8 coverage report
 */
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
    exclude: ['node_modules/**', 'dist/**'],
    css: false, // skip CSS imports in tests; we don't snapshot styles
    /**
     * The default `forks` pool spawns a fresh worker per test file, and each one
     * must load jsdom + React + testing-library before answering the pool's ping.
     * On a repo living under /mnt/c (WSL2 reading the Windows filesystem) that
     * routinely exceeds vitest's START_TIMEOUT — which is hardcoded at 60s and
     * NOT configurable, so no timeout setting can rescue it. The run then dies
     * with "Failed to start forks worker" before a single test executes, which
     * reads like a broken test rather than a slow filesystem.
     *
     * `vmThreads` reuses a VM context instead, so that cost is paid once.
     * Harmless on a normal filesystem; on this one it is the difference between
     * a green suite and a suite that cannot start.
     */
    pool: 'vmThreads',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/components/**', 'src/pages/**', 'src/services/**', 'src/stores/**', 'src/hooks/**'],
      exclude: ['**/__tests__/**', '**/*.test.{ts,tsx}', '**/*.d.ts'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
