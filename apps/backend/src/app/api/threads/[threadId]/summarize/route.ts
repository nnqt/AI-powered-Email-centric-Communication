import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";

import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Thread } from "@/models/Thread";
import { Message } from "@/models/Message";
import { AIService } from "@/modules/ai/ai.service";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ threadId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session as any).user.id as string | undefined;
    if (!userId) {
      return NextResponse.json(
        { error: "Missing user id in session" },
        { status: 400 }
      );
    }

    const { threadId } = await context.params;

    await connectToDatabase();

    // Find thread by Gmail thread ID and verify ownership
    const thread = await Thread.findOne({
      id: threadId,
      userId: new mongoose.Types.ObjectId(userId),
    });

    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    // Fetch messages for this thread
    const messages = await Message.find({ threadId: thread._id })
      .sort({ date: 1 })
      .lean();

    if (messages.length === 0) {
      return NextResponse.json(
        { error: "No messages in thread" },
        { status: 400 }
      );
    }

    // Call AI service
    const aiService = new AIService();
    const summary = await aiService.summarizeThread(
      threadId,
      messages.map((m) => ({
        id: m.id,
        from: m.from,
        to: m.to,
        date: m.date,
        body: m.body,
      }))
    );

    // Update thread with summary
    thread.summary = summary;
    await thread.save();

    return NextResponse.json({
      thread_id: threadId,
      summary: summary.text,
      key_issues: summary.key_issues,
      action_required: summary.action_required,
    });
  } catch (error: any) {
    console.error("Failed to summarize thread:", error);
    return NextResponse.json(
      {
        error: "Failed to summarize thread",
        details: error.message || String(error),
      },
      { status: 500 }
    );
  }
}
