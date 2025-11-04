import { axiosClient } from '../lib/axiosClient';
import { redisClient } from '../lib/redisClient';
import { logger } from '../lib/logger';
import { SummarizeRequest, SummarizeResponse } from '../types/ai.types';

const CACHE_TTL = 3600; // 1 hour in seconds

/**
 * Service for interacting with the AI microservice
 */
export class AIService {
  async summarizeThread(request: SummarizeRequest): Promise<SummarizeResponse> {
    try {
      // Generate cache key from thread content
      const cacheKey = `summary:${JSON.stringify(request.thread)}`;
      
      // Check cache first
      const cached = await redisClient.getCache<SummarizeResponse>(cacheKey);
      if (cached) {
        logger.info('Retrieved summary from cache');
        return cached;
      }

      const startTime = performance.now();
      
      const response = await axiosClient.post<SummarizeResponse>(
        '/summarize',
        request
      );
      
      const latencyMs = Math.round(performance.now() - startTime);
      logger.info(`AI summarization completed in ${latencyMs}ms`);
      
      // Cache the result
      await redisClient.setCache(cacheKey, response.data, CACHE_TTL);
      logger.info('Cached new summary');

      return response.data;
    } catch (error) {
      logger.error('AI service summarization failed:', { error });
      throw error;
    }
  }
}