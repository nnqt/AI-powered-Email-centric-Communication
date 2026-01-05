import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { GmailService } from "@/modules/email/gmail.service";

export async function POST(request: Request) {
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

    // Parse body for pageToken
    const body = await request.json().catch(() => ({}));
    const pageToken = body.pageToken;

    const service = new GmailService(userId);
    const result = await service.syncEmails(pageToken);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Email sync failed", error);

    // Check if it's an auth error (invalid/expired token)
    if (
      error.code === "UNAUTHORIZED" ||
      error.message?.includes("invalid_grant") ||
      error.message?.includes("refresh token") ||
      error.code === 401
    ) {
      return NextResponse.json(
        {
          error: "Authentication failed",
          message:
            "Your Google account authorization has expired. Please sign in again.",
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to sync emails",
        details: error.message || String(error),
      },
      { status: 500 }
    );
  }
}

export async function GET() {
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

    const { connectToDatabase } = await import("@/lib/db");
    const { User } = await import("@/models/User");
    await connectToDatabase();

    const user = await User.findById(userId).lean();

    return NextResponse.json({
      hasMore: !!user?.gmailNextPageToken,
      nextPageToken: user?.gmailNextPageToken,
      syncComplete: user?.gmailSyncComplete || false,
    });
  } catch (error: any) {
    console.error("Failed to get sync status", error);
    return NextResponse.json(
      { error: "Failed to get sync status" },
      { status: 500 }
    );
  }
}
