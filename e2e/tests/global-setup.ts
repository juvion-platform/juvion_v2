/**
 * Playwright global setup — runs ONCE before the test suite.
 *
 * Two responsibilities:
 *   1. Wait for the backend to be reachable (poll /api/health up to 30s).
 *      Fails LOUDLY if it never comes up, so test failures don't
 *      cascade from a missing process.
 *   2. Run the e2e user seed (idempotent) so login tests have known
 *      credentials.
 *
 * The dev servers themselves are NOT managed here — they're expected
 * to be running already (started by the developer or the CI workflow).
 * See playwright.config.ts and .github/workflows/e2e.yml for the
 * surrounding choreography.
 */

import { execSync } from 'node:child_process';
import path from 'node:path';

const BACKEND_URL = process.env.E2E_BACKEND_URL || 'http://localhost:3003';
const HEALTH_TIMEOUT_MS = 30_000;
const HEALTH_POLL_INTERVAL_MS = 1000;

async function waitForBackend(): Promise<void> {
  const url = `${BACKEND_URL}/api/health`;
  const started = Date.now();
  let lastError: unknown = null;

  while (Date.now() - started < HEALTH_TIMEOUT_MS) {
    try {
      const res = await fetch(url, { method: 'GET' });
      if (res.ok) {
        const body = (await res.json()) as { status?: string };
        if (body.status === 'ok') {
          // eslint-disable-next-line no-console
          console.log(`[global-setup] backend reachable at ${url}`);
          return;
        }
      }
      lastError = new Error(`health returned ${res.status}`);
    } catch (err) {
      lastError = err;
    }
    await new Promise((r) => setTimeout(r, HEALTH_POLL_INTERVAL_MS));
  }

  throw new Error(
    `[global-setup] backend at ${url} did not become healthy within ${HEALTH_TIMEOUT_MS / 1000}s. ` +
      `Last error: ${String(lastError)}`,
  );
}

function seedE2EUsers(): void {
  // Run the seed script in a subprocess so it brings its own mongoose
  // connection. Calling it in-process would require the admin-portal
  // workspace to take a transitive dep on the backend's models — not
  // acceptable for a clean module boundary.
  //
  // Playwright runs from `admin-portal/` cwd by convention; the repo
  // root is one level up. ESM-safe (no __dirname required).
  const repoRoot = path.resolve(process.cwd(), '..');
  // eslint-disable-next-line no-console
  console.log('[global-setup] seeding e2e users…');
  execSync('npm run seed:e2e-users -w backend', {
    cwd: repoRoot,
    stdio: 'inherit',
  });
}

export default async function globalSetup(): Promise<void> {
  await waitForBackend();
  seedE2EUsers();
}
