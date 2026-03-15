import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import { TelegramChat } from "@/models/TelegramChat";
import { TelegramMessage } from "@/models/TelegramMessage";
import { connectToDatabase } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { chatId } = await params;

    await connectToDatabase();

    const chat = await TelegramChat.findOne({
      userId: session.user.id,
      chatId,
    }).lean();

    if (!chat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    const messages = await TelegramMessage.find({
      userId: session.user.id,
      chatId,
    })
      .sort({ date: -1 })
      .limit(50)
      .lean();

    // Reset unread count
    if (chat.unreadCount > 0) {
      await TelegramChat.updateOne(
        { _id: chat._id },
        { $set: { unreadCount: 0 } }
      );
    }

    return NextResponse.json({
      chat: {
        ...chat,
        unreadCount: 0,
      },
      messages: messages.reverse(), // Return chronological order
    });
  } catch (error: any) {
    console.error(`[Telegram GET chat details] Error:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
