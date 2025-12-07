import { redisClient, withRedis } from "@/lib/redis";
import { logger } from "@/lib/logger";

export class CacheService {
  private DEFAULT_TTL = 3600; // 1 hour in seconds

  async get<T>(key: string): Promise<T | null> {
    return withRedis(async () => {
      const value = await redisClient.get(key);
      return value ? JSON.parse(value) : null;
    });
  }

  async set(
    key: string,
    value: unknown,
    ttl = this.DEFAULT_TTL
  ): Promise<void> {
    await withRedis(async () => {
      await redisClient.set(key, JSON.stringify(value), {
        EX: ttl,
      });
    });
  }

  async delete(key: string): Promise<void> {
    await withRedis(async () => {
      await redisClient.del(key);
    });
  }
}
