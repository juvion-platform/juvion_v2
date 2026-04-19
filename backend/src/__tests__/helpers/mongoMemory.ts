import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

/**
 * Shared Mongo in-memory setup for model-level unit/integration tests.
 *
 * Usage:
 *   import { setupMongo, teardownMongo, clearCollections } from '../../__tests__/helpers/mongoMemory';
 *
 *   beforeAll(async () => { await setupMongo(); });
 *   afterAll(async () => { await teardownMongo(); });
 *   afterEach(async () => { await clearCollections(); });
 *
 * The `binary.version` matches the app target (Mongo 7).
 */

let mongod: MongoMemoryServer | null = null;

export async function setupMongo(): Promise<void> {
  if (mongod) return;
  // Raise the per-instance launch timeout. Default is 10s which can be
  // tight on the first run (binary download, spawn latency) or on
  // loaded CI machines.
  mongod = await MongoMemoryServer.create({
    binary: { version: '7.0.0' },
    instance: { launchTimeout: 60_000 },
  });
  await mongoose.connect(mongod.getUri());
}

export async function teardownMongo(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongod) {
    await mongod.stop();
    mongod = null;
  }
}

export async function clearCollections(): Promise<void> {
  const db = mongoose.connection.db;
  if (!db) return;
  const collections = await db.collections();
  for (const c of collections) {
    await c.deleteMany({});
  }
}
