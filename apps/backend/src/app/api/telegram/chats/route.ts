import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import { TelegramChat } from "@/models/TelegramChat";
import { connectToDatabase } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const chats = await TelegramChat.find({ userId: session.user.id })
      .sort({ lastMessageDate: -1 })
      .lean();

    return NextResponse.json({ chats });
  } catch (error: any) {
    console.error("[Telegram GET chats] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
