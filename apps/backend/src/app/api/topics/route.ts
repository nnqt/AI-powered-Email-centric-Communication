import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { TopicService } from "@/modules/topics/topic.service";

const topicService = new TopicService();

/**
 * GET /api/topics
 * List all topics for the authenticated user, sorted by focusScore desc.
 *
 * Query params:
 *   limit?  number  (default 50, max 200)
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const limit = Math.min(
    200,
    parseInt(url.searchParams.get("limit") ?? "50", 10) || 50,
  );

  try {
    const topics = await topicService.listTopics(session.user.id, limit);
    return NextResponse.json({ topics });
  } catch (err: any) {
    console.error("[GET /api/topics]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
