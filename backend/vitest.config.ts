import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      // Measure everything except support scaffolding. Per-module ratchet
      // thresholds below keep CI honest as tests are added over time.
      include: [
        'src/modules/**',
        'src/middleware/**',
        'src/shared/**',
        'src/models/**',
        'src/config/**',
      ],
      exclude: [
        '**/__tests__/**',
        '**/*.test.ts',
        'src/seed.ts',
        'src/server.ts',
        'src/app.ts',
        'src/migrations/**',
        'src/**/index.ts', // barrel re-exports only
      ],
      reporter: ['text', 'text-summary'],
      // Ratchet-from-baseline thresholds.
      //
      // Philosophy: floors are calibrated slightly below the current
      // measured state so CI catches real regressions without blocking
      // green builds. Raise these (especially the global floor) as tests
      // are added per docs/tech-debt-remediation-plan.md phases P1-2,
      // P2-1, P2-2.
      //
      // Current measurements (2026-04-18, snapshot for ratchet tracking):
      //   Global: lines 2.68% / funcs 1.38% / stmts 2.18% / branches 2.21%
      //   src/middleware/**: funcs 36.36% / lines ~42%
      //   src/shared/rbac/**: lines 76.92% / funcs 76.19%
      thresholds: {
        // Global lower-bound — catches wholesale regressions (e.g. a test
        // file gets deleted). Floors chosen ~0.5pp under current baseline.
        lines: 2,
        functions: 1,
        statements: 2,
        branches: 2,
        // Middleware: we have rbac + webhook middleware tests.
        'src/middleware/**': { lines: 40, functions: 30, statements: 40, branches: 50 },
        // RBAC: well-covered (75%+); keep the floor high so we notice
        // regressions here.
        'src/shared/rbac/**': { lines: 70, functions: 70, statements: 70, branches: 70 },
      },
    },
  },
});
