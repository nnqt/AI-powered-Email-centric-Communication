import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { GmailService } from "@/modules/email/gmail.service";

// PATCH /api/threads/:threadId/archive
export async function PATCH(
  _request: NextRequest,
  context: { params: Promise<{ threadId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session as any).user.id as string | undefined;
    if (!userId) {
      return NextResponse.json({ error: "Missing user id" }, { status: 400 });
    }

    const { threadId } = await context.params;

    const service = new GmailService(userId);
    await service.archiveThread(threadId);

    return NextResponse.json({ success: true, threadId, isArchived: true });
  } catch (error: any) {
    console.error("Failed to archive thread", error);
    return NextResponse.json(
      { error: "Failed to archive thread", details: error.message },
      { status: 500 },
    );
  }
}
