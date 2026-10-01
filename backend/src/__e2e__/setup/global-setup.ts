import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { E2E_WORKERS } from './workers';

// One MongoDB server per vitest worker, so files run in parallel without sharing data;
// files on the same worker run one after another and cleanupTestApp() empties the
// database between them.
//
// Every server needs every model's indexes up front: building them is ten to twenty
// seconds per fresh server, and left to each worker's first test it pushed seed hooks
// past their 30-second timeout. Building on several servers at once is slower still
// (they contend for disk), so the indexes are built once on a template server whose data
// files are copied to each worker's server. The template is cached between runs, keyed
// by every model's collection and index definitions plus the MongoDB version, so it is
// rebuilt only when an index changes.
const MONGO_VERSION = '7.0.0';
const CACHE_ROOT = resolve(__dirname, '../../../node_modules/.cache/juvion-e2e-mongo');
const servers: MongoMemoryServer[] = [];
let root = '';

function indexFingerprint(): string {
  const shape = mongoose.modelNames().sort().map((name) => {
    const model = mongoose.model(name);
    return [name, model.collection.collectionName, model.schema.indexes()];
  });
  return createHash('sha256').update(JSON.stringify([MONGO_VERSION, shape])).digest('hex').slice(0, 16);
}

async function buildIndexes(uri: string): Promise<void> {
  const conn = await mongoose.createConnection(uri).asPromise();
  try {
    // allSettled, not all: a few models share a collection with differing index specs.
    // Mongoose's own autoIndex only emits those conflicts as model errors, so the
    // suite has always run with them; building ahead must not be stricter.
    await Promise.allSettled(
      mongoose.modelNames().map((name) => conn.model(name, mongoose.model(name).schema).createIndexes()),
    );
  } finally {
    await conn.close();
  }
}

const serverOn = (dbPath: string) =>
  MongoMemoryServer.create({ binary: { version: MONGO_VERSION }, instance: { dbPath, storageEngine: 'wiredTiger' } });

const exists = (p: string) => stat(p).then(() => true, () => false);

// After a clean shutdown mongod needs neither its journal (about 320 MB of preallocated
// files) nor its diagnostics; it recreates both on start. Copying only the data files
// keeps each worker's copy to roughly 10 MB.
const SKIP = new Set(['journal', 'diagnostic.data', 'mongod.lock']);
const copyData = (from: string, to: string) =>
  cp(from, to, { recursive: true, filter: (src) => !SKIP.has(src.slice(src.lastIndexOf('/') + 1)) });

/** A data directory holding every index, built on first use and reused while the fingerprint holds. */
async function templateDir(): Promise<string> {
  const cached = join(CACHE_ROOT, indexFingerprint());
  if (await exists(cached)) return cached;

  const building = join(root, 'template');
  await mkdir(building);
  const template = await serverOn(building);
  await buildIndexes(template.getUri());
  await template.stop({ doCleanup: false, force: false });

  // A concurrent run that also builds the template overwrites the cache entry with
  // identical content.
  await mkdir(CACHE_ROOT, { recursive: true });
  await copyData(building, cached).catch(() => undefined);
  return building;
}

export async function setup() {
  root = await mkdtemp(join(tmpdir(), 'juvion-e2e-'));

  // Importing the app registers every model, as each test file does through getTestApp().
  await import('../../app');

  const template = await templateDir();
  const paths = Array.from({ length: E2E_WORKERS }, (_, i) => join(root, `worker-${i + 1}`));
  await Promise.all(paths.map((p) => copyData(template, p)));
  const started = await Promise.all(paths.map(serverOn));
  servers.push(...started);
  started.forEach((s, i) => { process.env[`MONGO_TEST_URI_${i + 1}`] = s.getUri(); });
  process.env.MONGO_TEST_URI = started[0]!.getUri();
}

export async function teardown() {
  await Promise.all(servers.map((s) => s.stop({ doCleanup: false })));
  if (root) await rm(root, { recursive: true, force: true });
}
