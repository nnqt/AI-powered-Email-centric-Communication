import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import { getTelegramClient } from "@/lib/telegramManager";
import { TelegramChat } from "@/models/TelegramChat";
import { TelegramMessage } from "@/models/TelegramMessage";
import { connectToDatabase } from "@/lib/db";
import { emitToUser } from "@/lib/socketServer";
import { Api } from "telegram";
import bigInt from "big-integer";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { chatId, text } = body;

    if (!chatId || !text) {
      return NextResponse.json(
        { error: "Missing chatId or text" },
        { status: 400 }
      );
    }

    const client = await getTelegramClient(session.user.id);
    await connectToDatabase();

    try {
      // 1. Send the message via MTProto
      const result = await client.sendMessage(chatId, { message: text });
      
      const messageId = result.id.toString();
      const date = new Date(result.date * 1000);

      // 2. Save directly to DB as optimistic storage
      const updatedChat = await TelegramChat.findOneAndUpdate(
        { userId: session.user.id, chatId },
        {
          $set: {
            lastMessageDate: date,
          },
        },
        { new: true }
      );

      const newMessage = await TelegramMessage.findOneAndUpdate(
        { chatId, messageId },
        {
          $set: {
            userId: session.user.id,
            senderId: "me", // Could be actual ID, but 'me' works for outbound indicator
            text: text,
            date: date,
            isOutbound: true,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      // 3. Emit event to user so other sessions/tabs update
      emitToUser(session.user.id, "NEW_TELEGRAM_MESSAGE", {
        chatId,
        chat: updatedChat,
        message: newMessage,
      });

      return NextResponse.json({ message: newMessage });
    } catch (err: any) {
      console.error("[Telegram sendMessage error]", err);
      return NextResponse.json(
        { error: err.message || "Failed to send message" },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("[Telegram POST send] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
