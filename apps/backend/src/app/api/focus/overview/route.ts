import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { TopicService } from "@/modules/topics/topic.service";

const topicService = new TopicService();

// GET /api/focus/overview
// Lightweight counters for sidebar/badges and monitoring widgets.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const overview = await topicService.getFocusOverview(session.user.id);
    return NextResponse.json(overview);
  } catch (err: any) {
    console.error("[GET /api/focus/overview]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
