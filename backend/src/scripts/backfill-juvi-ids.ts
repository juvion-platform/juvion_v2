/**
 * Binds a Juvi ID to every User behind an existing JuviAccount (spec §9, step 2).
 *
 * RUN THIS BEFORE PROMOTING THE JUVI ID SIGN-IN BUILD. The new sign-in resolves a person by
 * `juviId` alone, so an account that has not been backfilled cannot sign in at all — everyone
 * un-migrated gets the generic 401 until this runs. The unique index must exist first
 * (`scripts/ensure-juvi-id-index.ts`); minting without it can hand two people the same ID.
 *
 * Idempotent and re-runnable: a row that already holds an ID is counted and skipped, never
 * re-minted (§4 — an ID is minted once). One broken row does not stop the run; it is reported,
 * counted, and makes the process exit non-zero so a deploy step notices.
 */
/* eslint-disable no-console */
import mongoose from 'mongoose';
import { JuviAccount } from '../models/juvi/JuviAccount';
import { ensureJuviId, readJuviId } from '../modules/juvi-app/accounts/provisioning-service';

export interface BackfillResult {
  scanned: number;
  minted: number;
  skipped: number;
  failed: number;
}

export async function backfillJuviIds(): Promise<BackfillResult> {
  const result: BackfillResult = { scanned: 0, minted: 0, skipped: 0, failed: 0 };
  // Projection-only, so the whole set of accounts is a few bytes each — this is a one-off
  // migration and reading it in one go keeps the failure reporting simple.
  const accounts = await JuviAccount.find({}).select('collegeId userId').lean();

  for (const account of accounts) {
    result.scanned += 1;
    const collegeId = String(account.collegeId);
    const userId = String(account.userId);
    try {
      if (await readJuviId(collegeId, userId)) {
        result.skipped += 1;
        continue;
      }
      await ensureJuviId({ collegeId, userId });
      result.minted += 1;
    } catch (e) {
      // An orphaned account (its User is gone) or an exhausted mint. Carry on: one broken row
      // must not deny every row after it an ID.
      result.failed += 1;
      console.error(`[backfill-juvi-ids] account ${String(account._id)}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return result;
}

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI ?? process.env.MONGO_URI;
  if (!uri) {
    console.error('[backfill-juvi-ids] set MONGODB_URI (or MONGO_URI)');
    process.exit(1);
  }
  await mongoose.connect(uri);
  try {
    const r = await backfillJuviIds();
    console.log(`[backfill-juvi-ids] scanned ${r.scanned}, minted ${r.minted}, skipped ${r.skipped}, failed ${r.failed}`);
    if (r.failed > 0) process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  main();
}
