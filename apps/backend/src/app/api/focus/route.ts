import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { TopicService } from "@/modules/topics/topic.service";

const topicService = new TopicService();

/**
 * GET /api/focus
 *
 * Returns the top topics for the Focus page, sorted by focusScore desc.
 * Each topic includes its primary contact info so the UI can render
 * the contact avatar / name without a second request.
 *
 * Query params:
 *   limit?   number  (default 20, max 100)
 *   refresh? "1"     if present, triggers a full re-score before returning
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const limit = Math.min(
    100,
    parseInt(url.searchParams.get("limit") ?? "20", 10) || 20,
  );
  const refresh = url.searchParams.get("refresh") === "1";

  try {
    // Optional: caller can force a re-score before fetching (e.g. after marking read)
    if (refresh) {
      await topicService.scoreAllTopicsForUser(session.user.id);
    }

    const topics = await topicService.getFocusTopics(session.user.id, limit);
    return NextResponse.json({ topics });
  } catch (err: any) {
    console.error("[GET /api/focus]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
