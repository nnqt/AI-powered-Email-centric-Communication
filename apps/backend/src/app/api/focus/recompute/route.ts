import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { TopicService } from "@/modules/topics/topic.service";
import { incrementMetric, observeMetricMs } from "@/lib/runtimeMetrics";

const topicService = new TopicService();

// POST /api/focus/recompute
// Explicit recompute endpoint so clients don't need to call /api/focus twice.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const limit = Math.min(
    100,
    parseInt(url.searchParams.get("limit") ?? "20", 10) || 20,
  );

  const startedAt = Date.now();
  try {
    await topicService.scoreAllTopicsForUser(session.user.id);
    const topics = await topicService.getFocusTopics(session.user.id, limit);
    const overview = await topicService.getFocusOverview(session.user.id);

    console.info(
      JSON.stringify({
        metric: "focus.recompute",
        user_id: session.user.id,
        latency_ms: Date.now() - startedAt,
        topic_count: topics.length,
      }),
    );
    incrementMetric("focus.recompute.success");
    observeMetricMs("focus.recompute.latency", Date.now() - startedAt);

    return NextResponse.json({ topics, overview });
  } catch (err: any) {
    incrementMetric("focus.recompute.error");
    observeMetricMs("focus.recompute.latency", Date.now() - startedAt);
    console.error("[POST /api/focus/recompute]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
