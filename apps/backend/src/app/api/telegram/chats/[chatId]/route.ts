import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import { TelegramChat } from "@/models/TelegramChat";
import { TelegramMessage } from "@/models/TelegramMessage";
import { connectToDatabase } from "@/lib/db";
import { syncChatHistory } from "@/lib/telegramManager";

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
    const userId = session.user.id;

    await connectToDatabase();

    const chat = await TelegramChat.findOne({
      userId,
      chatId,
    }).lean();

    if (!chat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    let messages = await TelegramMessage.find({
      userId,
      chatId,
    })
      .sort({ date: -1 })
      .limit(50)
      .lean();

    // If no messages in DB, pull history from Telegram
    if (messages.length === 0) {
      await syncChatHistory(userId, chatId);
      messages = await TelegramMessage.find({
        userId,
        chatId,
      })
        .sort({ date: -1 })
        .limit(50)
        .lean();
    }

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

