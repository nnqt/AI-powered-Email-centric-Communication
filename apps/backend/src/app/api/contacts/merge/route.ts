import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { emitToUser } from "@/lib/socketServer";
import { ContactService } from "@/modules/contacts/contact.service";
import { TopicService } from "@/modules/topics/topic.service";
import { redisClient } from "@/lib/redisClient";

const service = new ContactService();
const topicService = new TopicService();

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = (session as any).user.id as string | undefined;
    if (!userId) {
      return NextResponse.json({ error: "Missing user id" }, { status: 400 });
    }

    const body = await request.json();
    const { sourceId, targetId } = body as {
      sourceId?: string;
      targetId?: string;
    };
    if (!sourceId || !targetId) {
      return NextResponse.json(
        { error: "sourceId and targetId are required" },
        { status: 400 },
      );
    }
    if (sourceId === targetId) {
      return NextResponse.json(
        { error: "sourceId and targetId must be different" },
        { status: 400 },
      );
    }

    const merged = await service.mergeContacts(userId, sourceId, targetId);

    try {
      await topicService.mergeLikelyTopicsForUser(userId, [targetId]);
      await topicService.aiConsolidateTopicsForContacts(userId, [targetId]);
      await topicService.scoreAllTopicsForUser(userId);
    } catch (topicError: any) {
      console.warn("[POST /api/contacts/merge] topic consolidation failed", topicError?.message || topicError);
    }

    // Invalidate cached merge suggestions — contact list has changed
    await redisClient.clearCache(`contact:merge_suggestions:${userId}`);

    emitToUser(userId, "CONTACTS_UPDATED", {
      type: "merge",
      sourceId,
      targetId,
    });

    return NextResponse.json(merged);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to merge contacts", details: error.message },
      { status: 500 },
    );
  }
}
