import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { TimelineService } from "@/modules/timeline/timeline.service";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session as any).user.id as string | undefined;
    if (!userId) {
      return NextResponse.json(
        { error: "Missing user id in session" },
        { status: 400 }
      );
    }

    const url = new URL(request.url);
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) || 20 : 20;

    const service = new TimelineService();
    const threads = await service.getThreads(userId, limit);

    return NextResponse.json(threads);
  } catch (error: any) {
    console.error("Failed to fetch threads", error);
    return NextResponse.json(
      {
        error: "Failed to fetch threads",
        details: error.message || String(error),
      },
      { status: 500 }
    );
  }
}
