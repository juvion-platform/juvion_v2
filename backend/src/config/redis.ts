import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  // Redis is a cache here (policies, personas, scope, token versions). With
  // the offline queue on, every command issued while Redis is unreachable
  // waited on reconnect back-off — tens of seconds per request. Failing fast
  // lets each caller's try/catch fall through to Mongo immediately.
  enableOfflineQueue: false,
  connectTimeout: 2000,
});

redis.on('connect', () => console.log('Redis connected'));
redis.on('error', (err) => console.error('Redis error:', err));

export default redis;
