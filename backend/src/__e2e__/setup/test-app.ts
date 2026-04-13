import mongoose from 'mongoose';
import type { Express } from 'express';

let app: Express | null = null;

/**
 * Returns the Express app connected to the MongoMemoryServer.
 * Call in beforeAll of each test file.
 */
export async function getTestApp(): Promise<Express> {
  if (!app) {
    // Set env vars before importing app (app reads JWT_SECRET, NODE_ENV)
    process.env.JWT_SECRET = 'test-secret';
    process.env.NODE_ENV = 'test';
    process.env.RBAC_ENFORCE = 'false';

    const mod = await import('../../app');
    app = mod.default;
  }

  // Connect mongoose if not already connected
  if (mongoose.connection.readyState === 0) {
    const uri = process.env.MONGO_TEST_URI;
    if (!uri) throw new Error('MONGO_TEST_URI not set. Did global-setup run?');
    await mongoose.connect(uri);
  }

  return app;
}

/**
 * Drop all collections and disconnect. Call in afterAll of each test file.
 */
export async function cleanupTestApp(): Promise<void> {
  const collections = await mongoose.connection.db!.collections();
  for (const collection of collections) {
    await collection.deleteMany({});
  }
}
