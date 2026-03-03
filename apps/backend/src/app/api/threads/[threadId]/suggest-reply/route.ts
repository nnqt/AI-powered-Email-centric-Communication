import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { AIService } from "@/modules/ai/ai.service";
import { TimelineService } from "@/modules/timeline/timeline.service";

// POST /api/threads/:threadId/suggest-reply
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ threadId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session as any).user.id as string | undefined;
    if (!userId) {
      return NextResponse.json({ error: "Missing user id" }, { status: 400 });
    }

    const { threadId } = await context.params;

    // Optional format param in body: "email" | "message" (default: "message")
    const body = await request.json().catch(() => ({}));
    const format = (body.format ?? "message") as "email" | "message";

    // Fetch thread + messages from DB
    const timeline = new TimelineService();
    const result = await timeline.getThreadDetails(userId, threadId);

    if (!result) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    const { thread, messages } = result;

    if (!messages || messages.length === 0) {
      return NextResponse.json(
        { error: "No messages found in thread" },
        { status: 422 },
      );
    }

    // Use the latest message for suggestion
    const latest = messages[messages.length - 1];

    // Build short context: use AI summary if available, otherwise subject
    const conversationContext =
      thread.summary?.text ||
      (thread.subject ? `Thread subject: ${thread.subject}` : undefined);

    const aiService = new AIService();
    const result2 = await aiService.suggestReplies(
      threadId,
      {
        id: latest.id,
        from: latest.from,
        text: latest.body || latest.snippet || "",
      },
      conversationContext,
      3,
      format,
    );

    return NextResponse.json({
      threadId,
      format: result2.format,
      replies: result2.replies,
    });
  } catch (error: any) {
    console.error("Failed to suggest replies", error);
    return NextResponse.json(
      { error: "Failed to suggest replies", details: error.message },
      { status: 500 },
    );
  }
}
