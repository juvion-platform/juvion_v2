/**
 * Create the users.juviId unique partial index where `autoIndex` is off.
 *
 * `juviId` is the Juvi app's only login key and the one key that is unique across
 * every college, so the index is global and unique. It is partial
 * (`partialFilterExpression: { juviId: { $type: 'string' } }`) so the Users that are
 * not Juvi accounts — ERP admins, and super_admin, which has no collegeId — are not
 * indexed under `undefined` and cannot collide with one another.
 *
 * There is no legacy index to drop: the field is new, so this only ever creates.
 * Idempotent — re-running once the index is in place is a no-op.
 *
 *   npx ts-node -r dotenv/config src/scripts/ensure-juvi-id-index.ts
 */
/* eslint-disable no-console */
import mongoose from 'mongoose';

const INDEX_NAME = 'juviId_1';

interface IndexInfo {
  name: string;
  partialFilterExpression?: Record<string, unknown>;
}

export async function ensureJuviIdIndex(): Promise<{ action: 'created' | 'already-correct' }> {
  const collection = mongoose.connection.collection('users');
  const indexes = (await collection.indexes()) as unknown as IndexInfo[];

  if (indexes.some((i) => i.name === INDEX_NAME && i.partialFilterExpression)) {
    console.log(`[ensure-juvi-id-index] ${INDEX_NAME} already partial — nothing to do.`);
    return { action: 'already-correct' };
  }

  await collection.createIndex(
    { juviId: 1 },
    { unique: true, partialFilterExpression: { juviId: { $type: 'string' } }, name: INDEX_NAME },
  );
  console.log(`[ensure-juvi-id-index] created ${INDEX_NAME} with a partial filter.`);
  return { action: 'created' };
}

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI ?? process.env.MONGO_URI;
  if (!uri) {
    console.error('[ensure-juvi-id-index] MONGODB_URI is not set.');
    process.exit(1);
  }
  await mongoose.connect(uri);
  try {
    await ensureJuviIdIndex();
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  main();
}
