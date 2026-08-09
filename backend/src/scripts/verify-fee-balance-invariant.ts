/**
 * Verify the StudentFeeAccount balance invariant for 007-billed students.
 *
 *   balance === totalDue − totalPaid − totalWaived + totalRefunded
 *
 * The `+ totalRefunded` matches the actual refund writer (fee-lifecycle-service.ts:1516
 * does `totalRefunded += X` AND `balance += X`) — a refund raises what is owed (G2-H1).
 *
 * SCOPED to students the 007 flow touched — those with an `isSemesterInstallment:true`
 * invoice. Deliberately NOT run over every account: seeded/admissions accounts carry
 * balances this formula never produced and would false-flag (fixture noise, not a defect).
 * StudentFeeAccount has ~a dozen writers, so this is the guard that catches a drifting one.
 *
 *   npx ts-node -r dotenv/config src/scripts/verify-fee-balance-invariant.ts [collegeId]
 */
/* eslint-disable no-console */
import mongoose from 'mongoose';

import { Invoice } from '../models/finance/Invoice';
import { StudentFeeAccount } from '../models/finance/StudentFeeAccount';

export interface BalanceViolation {
  studentId: string;
  balance: number;
  expected: number;
}

export interface InvariantResult {
  checked: number;
  violations: BalanceViolation[];
}

export async function verifyFeeBalanceInvariant(collegeId?: string): Promise<InvariantResult> {
  const cid = collegeId ? new mongoose.Types.ObjectId(collegeId) : undefined;

  const invoiceFilter: Record<string, unknown> = { isSemesterInstallment: true };
  if (cid) invoiceFilter.collegeId = cid;
  const studentIds = await Invoice.distinct('studentId', invoiceFilter);

  const acctFilter: Record<string, unknown> = { studentId: { $in: studentIds } };
  if (cid) acctFilter.collegeId = cid;
  const accounts = await StudentFeeAccount.find(acctFilter).lean();

  const violations: BalanceViolation[] = [];
  for (const a of accounts) {
    const expected = (a.totalDue ?? 0) - (a.totalPaid ?? 0) - (a.totalWaived ?? 0) + (a.totalRefunded ?? 0);
    if ((a.balance ?? 0) !== expected) {
      violations.push({ studentId: String(a.studentId), balance: a.balance ?? 0, expected });
    }
  }
  return { checked: accounts.length, violations };
}

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI ?? process.env.MONGO_URI;
  if (!uri) {
    console.error('[verify-fee-balance] MONGODB_URI is not set.');
    process.exit(1);
  }
  await mongoose.connect(uri);
  try {
    const { checked, violations } = await verifyFeeBalanceInvariant(process.argv[2]);
    console.log(`[verify-fee-balance] checked ${checked} installment-billed account(s); ${violations.length} violation(s).`);
    for (const v of violations) {
      console.error(`  student ${v.studentId}: balance ${v.balance} ≠ expected ${v.expected}`);
    }
    if (violations.length > 0) process.exit(2);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  main();
}
