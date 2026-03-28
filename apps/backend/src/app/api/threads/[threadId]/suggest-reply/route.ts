import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { AIService } from "@/modules/ai/ai.service";
import { TimelineService } from "@/modules/timeline/timeline.service";
import { Contact } from "@/models/Contact";

const USER_CONTEXT_BUDGET = 1200;

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
    const selectedNextActions = Array.isArray(body.selectedNextActions)
      ? body.selectedNextActions
          .filter((item: unknown) => typeof item === "string")
          .map((item: string) => item.trim())
          .filter(Boolean)
      : [];
    const additionalContext =
      typeof body.additionalContext === "string"
        ? body.additionalContext.trim()
        : "";

    const userContextLength =
      selectedNextActions.join("\n").length + additionalContext.length;
    if (userContextLength > USER_CONTEXT_BUDGET) {
      return NextResponse.json(
        {
          error: "Context too long",
          code: "CONTEXT_BUDGET_EXCEEDED",
          budget: USER_CONTEXT_BUDGET,
          currentLength: userContextLength,
        },
        { status: 422 },
      );
    }

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
    let conversationContext: string | undefined;
    if (thread.summary?.text) {
      // Handle both string and array summary formats
      if (Array.isArray(thread.summary.text)) {
        conversationContext = thread.summary.text.join(" ");
      } else {
        conversationContext = thread.summary.text;
      }
    } else if (thread.subject) {
      conversationContext = `Thread subject: ${thread.subject}`;
    }

    // Extract thread intent from thread categories (first category if exists)
    let threadIntent: string | undefined;
    if (thread.categories && thread.categories.length > 0) {
      threadIntent = thread.categories[0];
    }

    // Extract sender category from contact
    let senderCategory: string | undefined;
    if (latest.from) {
      try {
        const senderContact = await Contact.findOne({
          email: latest.from,
          userId,
        });
        if (senderContact?.category) {
          senderCategory = senderContact.category;
        }
      } catch (err) {
        // Contact lookup failed, continue without sender_category
        console.debug("Failed to fetch sender contact category", err);
      }
    }

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
      threadIntent,
      senderCategory,
      selectedNextActions,
      additionalContext,
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
