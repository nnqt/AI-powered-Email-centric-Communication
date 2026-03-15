import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Thread } from "@/models/Thread";
import { Contact } from "@/models/Contact";
import { AIService } from "@/modules/ai/ai.service";
import mongoose from "mongoose";

const aiService = new AIService();

/**
 * POST /api/threads/[threadId]/categories
 *
 * Manually trigger (or force re-run) thread category classification.
 * Uses the same AI pipeline as the background sync job.
 * Idempotent: re-runs even if already classified.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ threadId: string }> },
) {
  try {
    const { threadId } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = (session as any).user.id as string | undefined;
    if (!userId) {
      return NextResponse.json({ error: "Missing user id" }, { status: 400 });
    }

    await connectToDatabase();

    const thread = await Thread.findOne({
      id: threadId,
      userId: new mongoose.Types.ObjectId(userId),
    }).lean();

    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    // Resolve sender email from participants[0]
    let senderEmail: string | undefined;
    let senderCategories: string[] | undefined;

    if (thread.participants?.[0]) {
      const raw = thread.participants[0];
      const match = raw.match(/<([^>]+)>/);
      senderEmail = (match ? match[1] : raw).trim().toLowerCase();

      const contact = await Contact.findOne({
        userId: new mongoose.Types.ObjectId(userId),
        email: senderEmail,
      }).lean();
      if (contact?.categories?.length) {
        senderCategories = contact.categories as string[];
      }
    }

    const { categories, noiseFiltered } =
      await aiService.classifyThreadCategory(
        threadId,
        thread.subject,
        thread.snippet,
        senderEmail,
        senderCategories,
      );

    await Thread.updateOne(
      { id: threadId },
      {
        categories,
        noiseFiltered,
        categorizedAt: new Date(),
        categorySource: "ai",
      },
    );

    return NextResponse.json({ categories, noiseFiltered });
  } catch (error: any) {
    console.error("[threads/categories] error:", error.message);
    return NextResponse.json(
      { error: "Category classification failed", details: error.message },
      { status: 500 },
    );
  }
}
