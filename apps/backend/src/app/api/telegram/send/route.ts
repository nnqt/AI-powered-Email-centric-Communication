import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import { sendTelegramMessage } from "@/lib/telegramManager";

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
        { status: 400 },
      );
    }

    try {
      const result = await sendTelegramMessage(session.user.id, chatId, text);

      return NextResponse.json({
        message: result.message,
        sentToTelegram: result.sentToTelegram,
      });
    } catch (err: any) {
      console.error("[Telegram sendMessage error]", err);
      return NextResponse.json(
        { error: err.message || "Failed to send message" },
        { status: 500 },
      );
    }
  } catch (error: any) {
    console.error("[Telegram POST send] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
