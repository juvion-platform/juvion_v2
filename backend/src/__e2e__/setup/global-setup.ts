import { MongoMemoryServer } from 'mongodb-memory-server';

let mongod: MongoMemoryServer;

export async function setup() {
  mongod = await MongoMemoryServer.create({
    binary: { version: '7.0.0' },
  });
  process.env.MONGO_TEST_URI = mongod.getUri();
}

export async function teardown() {
  if (mongod) {
    await mongod.stop();
  }
}
