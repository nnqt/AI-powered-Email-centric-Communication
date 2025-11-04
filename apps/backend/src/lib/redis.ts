import { createClient } from 'redis';
import { logger } from './logger';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redisClient = createClient({
  url: redisUrl,
});

redisClient.on('error', (err) => {
  logger.error('Redis Client Error:', err);
});

redisClient.on('connect', () => {
  logger.info('Redis Client Connected');
});

// Wrapper for Redis operations with error handling
export async function withRedis<T>(operation: () => Promise<T>): Promise<T | null> {
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
    return await operation();
  } catch (error) {
    logger.error('Redis operation failed:', error);
    return null;
  }
}