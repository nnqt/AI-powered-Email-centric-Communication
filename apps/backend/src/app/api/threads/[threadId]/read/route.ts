import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { GmailService } from "@/modules/email/gmail.service";

// PATCH /api/threads/:threadId/read
// Body: { read: boolean }
export async function PATCH(
  request: NextRequest,
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
    const body = await request.json();
    const read: boolean = body.read ?? true;

    const service = new GmailService(userId);
    await service.markRead(threadId, read);

    return NextResponse.json({ success: true, threadId, isRead: read });
  } catch (error: any) {
    console.error("Failed to update read state", error);
    return NextResponse.json(
      { error: "Failed to update read state", details: error.message },
      { status: 500 },
    );
  }
}
