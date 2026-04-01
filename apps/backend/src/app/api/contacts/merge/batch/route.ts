import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { emitToUser } from "@/lib/socketServer";
import { ContactService } from "@/modules/contacts/contact.service";
import { TopicService } from "@/modules/topics/topic.service";
import { redisClient } from "@/lib/redisClient";

const service = new ContactService();
const topicService = new TopicService();

type MergePair = {
  sourceId: string;
  targetId: string;
};

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
    const merges = ((body?.merges ?? []) as MergePair[]).filter(
      (m) => m?.sourceId && m?.targetId && m.sourceId !== m.targetId,
    );

    if (merges.length === 0) {
      return NextResponse.json({ error: "No valid merge pairs" }, { status: 400 });
    }

    const seenSources = new Set<string>();
    const normalized: MergePair[] = [];
    for (const pair of merges) {
      if (seenSources.has(pair.sourceId)) continue;
      seenSources.add(pair.sourceId);
      normalized.push(pair);
    }

    const errors: Array<{ sourceId: string; targetId: string; reason: string }> = [];
    let applied = 0;
    const touchedTargetIds = new Set<string>();

    for (const pair of normalized) {
      try {
        await service.mergeContacts(userId, pair.sourceId, pair.targetId);
        applied += 1;
        touchedTargetIds.add(pair.targetId);
      } catch (error: any) {
        errors.push({
          sourceId: pair.sourceId,
          targetId: pair.targetId,
          reason: error?.message || "merge failed",
        });
      }
    }

    if (touchedTargetIds.size > 0) {
      try {
        const targetIds = Array.from(touchedTargetIds);
        await topicService.mergeLikelyTopicsForUser(userId, targetIds);
        await topicService.aiConsolidateTopicsForContacts(userId, targetIds);
        await topicService.scoreAllTopicsForUser(userId);
      } catch (topicError: any) {
        console.warn(
          "[POST /api/contacts/merge/batch] topic consolidation failed",
          topicError?.message || topicError,
        );
      }
    }

    await redisClient.clearCache(`contact:merge_suggestions:${userId}`);

    emitToUser(userId, "CONTACTS_UPDATED", {
      type: "merge_batch",
      targetIds: Array.from(touchedTargetIds),
      applied,
      failed: errors.length,
    });

    return NextResponse.json({
      applied,
      failed: errors.length,
      errors,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to merge contacts", details: error.message },
      { status: 500 },
    );
  }
}
