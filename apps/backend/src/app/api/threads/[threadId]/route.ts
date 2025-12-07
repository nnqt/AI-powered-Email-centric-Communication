import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { TimelineService } from "@/modules/timeline/timeline.service";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ threadId: string }> }
) {
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

    const { threadId } = await context.params;
    const service = new TimelineService();
    const result = await service.getThreadDetails(userId, threadId);

    if (!result) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Failed to fetch thread details", error);
    return NextResponse.json(
      {
        error: "Failed to fetch thread details",
        details: error.message || String(error),
      },
      { status: 500 }
    );
  }
}
