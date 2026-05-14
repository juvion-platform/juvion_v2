import 'dotenv/config';
import { connectDB } from './config/db';
import app from './app';
import { registerProposalExpiryQueue } from './shared/jobs/proposal-expiry-worker';
import { initBridgeListeners } from './modules/platform/erpnext-bridge';

const PORT = process.env.PORT || 3003;

async function start() {
  await connectDB();

  // Background workers — guarded so Redis-less environments (e.g. CI, local
  // dev without docker) can opt out.
  if (process.env.DISABLE_BACKGROUND_JOBS !== 'true') {
    try {
      await registerProposalExpiryQueue();
    } catch (err) {
      console.warn('[server] Failed to register proposal-expiry queue (Redis unavailable?):', err);
    }
  }

  // Strategic Gap 8 — wire the ERPNext / Frappe HR bridge listeners
  // to the event bus. Idempotent + safe with no config row (the
  // listener bails when no per-college config or enabledChannels match).
  initBridgeListeners();

  app.listen(PORT, () => {
    console.log(`Juvion v2 API running on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
