import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/ai/summarize
 * 
 * Forwards text content to AI service for summarization.
 * Accepts a content string and returns the AI-generated summary.
 * 
 * @param request - Next.js request object containing JSON body with content field
 * @returns JSON response with summary data or error message
 * 
 * @example
 * POST /api/ai/summarize
 * {
 *   "content": "Hello, can we meet tomorrow?"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Validate request body
    const { content } = await request.json();

    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { 
          error: 'Content field is required and must be a string',
          status: 400,
          timestamp: new Date().toISOString()
        },
        { status: 400 }
      );
    }

    // Get AI service URL from environment
    const aiServiceUrl = process.env.AI_SERVICE_URL;
    if (!aiServiceUrl) {
      throw new Error('AI_SERVICE_URL environment variable is not configured');
    }

    // Start latency measurement
    const startTime = performance.now();
    
    // Call AI service with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    try {
      const response = await fetch(`${aiServiceUrl}/summarize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ thread: [{ text: content }] }), // Format as per AI service spec
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`AI service responded with status: ${response.status}`);
      }

      const data = await response.json();
      
      // Calculate and log latency
      const latencyMs = Math.round(performance.now() - startTime);
      console.info(`AI summarize request completed in ${latencyMs}ms`);
      
      return NextResponse.json({
        ...data,
        status: 200,
        timestamp: new Date().toISOString(),
        latency: latencyMs
      });
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error: unknown) {
    console.error('Error in /api/ai/summarize:', error);
    
    // Handle different error types
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.error('AI service connection failed:', error.message);
      return NextResponse.json(
        {
          error: 'AI service is currently unavailable',
          status: 503,
          timestamp: new Date().toISOString(),
          details: 'Could not establish connection to AI service'
        },
        { status: 503 }
      );
    }
    
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json(
        {
          error: 'Request timeout',
          status: 504,
          timestamp: new Date().toISOString()
        },
        { status: 504 }
      );
    }

    return NextResponse.json(
      {
        error: 'Internal server error',
        status: 500,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}