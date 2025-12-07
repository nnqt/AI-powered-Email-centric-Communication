import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { GmailService } from "@/modules/email/gmail.service";

export async function POST() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !session.user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session as any).user.id as string | undefined;
    if (!userId) {
      return NextResponse.json(
        { error: "Missing user id in session" },
        { status: 400 }
      );
    }

    const service = new GmailService(userId);
    const { syncedMessages } = await service.syncEmails();

    return NextResponse.json({ syncedMessages });
  } catch (error: any) {
    console.error("Email sync failed", error);
    return NextResponse.json(
      {
        error: "Failed to sync emails",
        details: error.message || String(error),
      },
      { status: 500 }
    );
  }
}
