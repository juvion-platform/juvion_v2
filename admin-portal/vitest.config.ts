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
