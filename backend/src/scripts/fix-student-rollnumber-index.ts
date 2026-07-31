/**
 * Replace the students (collegeId, rollNumber) unique index.
 *
 * The old definition was `{ unique: true, sparse: true }`. On a COMPOUND
 * index `sparse` omits a document only when every indexed field is absent,
 * and `collegeId` never is — so every student without a roll number was
 * indexed under `{ collegeId, null }` and a college could hold exactly one of
 * them. The second import of a roll-number-less student failed with E11000.
 *
 * The replacement uses `partialFilterExpression: { rollNumber: { $type:
 * 'string' } }`, which indexes only the students that actually have one.
 *
 * Mongoose cannot do this itself: `createIndex` on an existing key pattern
 * with different options raises IndexOptionsConflict, so the old index has to
 * be dropped first. This script is that step.
 *
 * Safe on existing data by construction — the new index is strictly weaker
 * than the old one, so anything that satisfied the old constraint satisfies
 * the new one. There is no possible duplicate to trip over.
 *
 * Idempotent: re-running once the new index is in place is a no-op.
 *
 *   npx ts-node -r dotenv/config src/scripts/fix-student-rollnumber-index.ts
 */
/* eslint-disable no-console */
import mongoose from 'mongoose';

const INDEX_NAME = 'collegeId_1_rollNumber_1';

interface IndexInfo {
  name: string;
  sparse?: boolean;
  partialFilterExpression?: Record<string, unknown>;
}

export async function fixStudentRollNumberIndex(): Promise<{
  action: 'dropped-and-recreated' | 'already-correct' | 'absent';
}> {
  const collection = mongoose.connection.collection('students');
  const indexes = (await collection.indexes()) as unknown as IndexInfo[];
  const existing = indexes.find((i) => i.name === INDEX_NAME);

  if (existing?.partialFilterExpression) {
    console.log(`[fix-rollnumber-index] ${INDEX_NAME} already partial — nothing to do.`);
    return { action: 'already-correct' };
  }

  if (existing) {
    console.log(`[fix-rollnumber-index] dropping ${INDEX_NAME} (sparse=${existing.sparse})`);
    await collection.dropIndex(INDEX_NAME);
  }

  await collection.createIndex(
    { collegeId: 1, rollNumber: 1 },
    { unique: true, partialFilterExpression: { rollNumber: { $type: 'string' } }, name: INDEX_NAME },
  );
  console.log(`[fix-rollnumber-index] created ${INDEX_NAME} with a partial filter.`);
  return { action: existing ? 'dropped-and-recreated' : 'absent' };
}

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI ?? process.env.MONGO_URI;
  if (!uri) {
    console.error('[fix-rollnumber-index] MONGODB_URI is not set.');
    process.exit(1);
  }
  await mongoose.connect(uri);
  try {
    await fixStudentRollNumberIndex();
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  main();
}
