import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import { TelegramChat } from "@/models/TelegramChat";
import { User } from "@/models/User";
import { connectToDatabase } from "@/lib/db";
import { syncDialogs } from "@/lib/telegramManager";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const userId = session.user.id;
    let chats = await TelegramChat.find({ userId })
      .sort({ lastMessageDate: -1 })
      .lean();

    // If no chats in DB but user has linked Telegram, do initial sync
    if (chats.length === 0) {
      const user = await User.findById(userId).lean();
      if (user?.telegramSession) {
        await syncDialogs(userId);
        chats = await TelegramChat.find({ userId })
          .sort({ lastMessageDate: -1 })
          .lean();
      }
    }

    return NextResponse.json({ chats });
  } catch (error: any) {
    console.error("[Telegram GET chats] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

