/**
 * Create the 007 semester-installment idempotency index on `invoices`.
 *
 * A NEW partial unique index — `{ collegeId, studentId, semesterId }` filtered to
 * `{ isSemesterInstallment: true, studentId:$type objectId, semesterId:$type objectId }`
 * — enforcing at most one tuition-installment invoice per (student, semester).
 *
 * Keyed on the POSITIVE `isSemesterInstallment` flag, never on `type:'fee'`, because
 * exam-fee invoices are also `type:'fee'` with a `semesterId` (G2-C1). The
 * `$type:'objectId'` guards keep any flag-set row lacking either id out of the index
 * so it can never collapse to `{collegeId,null,null}` (the rollNumber E11000 trap).
 *
 * Mongoose does not build this on its own on an existing DB (autoIndex is off in
 * production, and it won't alter an existing key pattern), so this script is the
 * deploy step. Because `isSemesterInstallment` is brand new, no existing invoice
 * carries it → there is nothing to collide, but we pre-check anyway before building,
 * since a unique-index build fails hard on pre-existing violators.
 *
 * Idempotent: re-running once the index exists is a no-op.
 *
 *   npx ts-node -r dotenv/config src/scripts/fix-invoice-semester-installment-index.ts
 */
/* eslint-disable no-console */
import mongoose from 'mongoose';

const INDEX_NAME = 'collegeId_1_studentId_1_semesterId_1';

export async function fixInvoiceSemesterInstallmentIndex(): Promise<{
  action: 'created' | 'already-present';
  violators: number;
}> {
  const collection = mongoose.connection.collection('invoices');

  // ── Pre-check: any existing (collegeId, studentId, semesterId) duplicates among
  //    installment invoices would fail the unique build. Refuse loudly instead.
  const dupes = await collection
    .aggregate([
      { $match: { isSemesterInstallment: true, studentId: { $type: 'objectId' }, semesterId: { $type: 'objectId' } } },
      { $group: { _id: { c: '$collegeId', s: '$studentId', sem: '$semesterId' }, n: { $sum: 1 } } },
      { $match: { n: { $gt: 1 } } },
      { $count: 'groups' },
    ])
    .toArray();
  const violators = (dupes[0]?.groups as number | undefined) ?? 0;
  if (violators > 0) {
    throw new Error(
      `[fix-invoice-installment-index] ${violators} (collegeId,studentId,semesterId) group(s) already hold >1 installment invoice — resolve before building the unique index.`,
    );
  }

  const existing = (await collection.indexes()).find((i) => i.name === INDEX_NAME);
  if (existing) {
    console.log(`[fix-invoice-installment-index] ${INDEX_NAME} already present — nothing to do.`);
    return { action: 'already-present', violators };
  }

  await collection.createIndex(
    { collegeId: 1, studentId: 1, semesterId: 1 },
    {
      unique: true,
      partialFilterExpression: {
        isSemesterInstallment: true,
        studentId: { $type: 'objectId' },
        semesterId: { $type: 'objectId' },
      },
      name: INDEX_NAME,
    },
  );
  console.log(`[fix-invoice-installment-index] created ${INDEX_NAME} (partial, unique).`);
  return { action: 'created', violators };
}

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI ?? process.env.MONGO_URI;
  if (!uri) {
    console.error('[fix-invoice-installment-index] MONGODB_URI is not set.');
    process.exit(1);
  }
  await mongoose.connect(uri);
  try {
    await fixInvoiceSemesterInstallmentIndex();
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  main();
}
