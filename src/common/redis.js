import { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

export const redisConnection = new Redis(env.UPSTASH_REDIS_URL, {
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
  lazyConnect: true,
  tls: env.UPSTASH_REDIS_URL.startsWith('rediss://') ? {} : undefined,
  retryStrategy(times) {
    if (env.NODE_ENV === 'test') return null; // Don't retry indefinitely in tests
    return Math.min(times * 150, 3000);
  }
});

redisConnection.on('error', (err) => {
  logger.warn({ err: err.message }, 'Redis connection warning');
});

redisConnection.on('connect', () => {
  logger.info('Connected to Redis data store');
});

