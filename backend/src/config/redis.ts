import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  // Offline queue stays on (Juvi cooldown/locks rely on it); fail-fast RBAC cache reads would need a dedicated client.
  connectTimeout: 2000,
});

redis.on('connect', () => console.log('Redis connected'));
redis.on('error', (err) => console.error('Redis error:', err));

export default redis;
