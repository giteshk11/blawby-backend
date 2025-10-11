import Redis from 'ioredis';

export const redisConnection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD,
  db: Number(process.env.REDIS_DB) || 0,
  maxRetriesPerRequest: null, // REQUIRED for BullMQ
  enableReadyCheck: false,
});

// Handle Redis connection events
redisConnection.on('connect', () => {
  console.log('✅ Redis connected');
});

redisConnection.on('error', (error) => {
  console.error('❌ Redis connection error:', error);
});

redisConnection.on('close', () => {
  console.log('🔌 Redis connection closed');
});
