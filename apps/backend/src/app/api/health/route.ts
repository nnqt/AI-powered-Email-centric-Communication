import { NextResponse } from 'next/server';
import { redisClient } from '@/lib/redis';
import { logger } from '@/lib/logger';

export async function GET() {
  const services = {
    redis: false
  };

  // Check Redis connection
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
    await redisClient.ping();
    services.redis = true;
  } catch (error) {
    logger.error('Redis health check failed:', {error});
  }

  const isHealthy = Object.values(services).every(Boolean);

  return NextResponse.json({
    status: isHealthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    services
  }, {
    status: isHealthy ? 200 : 503
  });
}