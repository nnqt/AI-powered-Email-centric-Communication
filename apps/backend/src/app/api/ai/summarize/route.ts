import { NextRequest, NextResponse } from 'next/server';
import { AIService } from '@/services/ai.service';
import { logger } from '@/lib/logger';
import { SummarizeRequest } from '@/types/ai.types';

const aiService = new AIService();

/**
 * Validate the request body matches our expected schema
 */
function validateRequest(body: unknown): SummarizeRequest {
  if (!body || typeof body !== 'object') {
    throw new Error('Request body must be an object');
  }

  if (!('thread' in body) || !Array.isArray(body.thread)) {
    throw new Error('Request body must contain a thread array');
  }

  const { thread } = body as { thread: unknown[] };
  
  if (!thread.every(msg => 
    msg && typeof msg === 'object' && 
    'text' in msg && typeof msg.text === 'string'
  )) {
    throw new Error('Each message in thread must have a text field');
  }

  return body as SummarizeRequest;
}

/**
 * POST /api/ai/summarize
 * Forwards a thread of messages to the AI service for summarization.
 */
export async function POST(request: NextRequest) {
  logger.time('summarize-request');
  
  try {
    const body = await request.json();
    const validatedRequest = validateRequest(body);
    
    const summary = await aiService.summarizeThread(validatedRequest);
    
    logger.timeEnd('summarize-request');
    
    return NextResponse.json({
      summary: summary.summary,
      status: 'success'
    });

  } catch (error: unknown) {
    logger.error('Summarization failed', { error });
    
    // Handle AI service connection errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return NextResponse.json(
        { error: 'AI service unavailable', status: 'error' },
        { status: 503 }
      );
    }
    
    // Handle validation errors
    if (error instanceof Error && error.message.includes('Request body')) {
      return NextResponse.json(
        { error: error.message, status: 'error' },
        { status: 400 }
      );
    }

    // Handle all other errors
    return NextResponse.json(
      { error: 'Internal server error', status: 'error' },
      { status: 500 }
    );
  }
}