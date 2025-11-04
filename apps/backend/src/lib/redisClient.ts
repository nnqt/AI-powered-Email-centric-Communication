import Redis from 'ioredis';
import { logger } from './logger';

class RedisClient {
  private static instance: RedisClient;
  private client: Redis | null = null;
  private isConnected = false;

  private constructor() {
    this.initializeClient();
  }

  private initializeClient() {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      this.client = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        reconnectOnError(err) {
          logger.warn('Redis reconnection attempt due to error:', {err});
          return true;
        }
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        logger.info('Redis client connected successfully');
      });

      this.client.on('error', (error) => {
        this.isConnected = false;
        logger.warn('Redis connection error:', {error});
      });

    } catch (error) {
      logger.warn('Failed to initialize Redis client:', {error});
      this.client = null;
    }
  }

  public static getInstance(): RedisClient {
    if (!RedisClient.instance) {
      RedisClient.instance = new RedisClient();
    }
    return RedisClient.instance;
  }

  async getCache<T>(key: string): Promise<T | null> {
    if (!this.client || !this.isConnected) {
      logger.warn('Redis not available, skipping cache get');
      return null;
    }

    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Redis get error:', {error});
      return null;
    }
  }

  async setCache(key: string, value: unknown, ttlSeconds?: number): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      logger.warn('Redis not available, skipping cache set');
      return false;
    }

    try {
      const serializedValue = JSON.stringify(value);
      if (ttlSeconds) {
        await this.client.setex(key, ttlSeconds, serializedValue);
      } else {
        await this.client.set(key, serializedValue);
      }
      return true;
    } catch (error) {
      logger.error('Redis set error:', {error});
      return false;
    }
  }

  async clearCache(key: string): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      logger.warn('Redis not available, skipping cache clear');
      return false;
    }

    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      logger.error('Redis delete error:', {error});
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
      logger.info('Redis client disconnected');
    }
  }
}

// Export a singleton instance
export const redisClient = RedisClient.getInstance();