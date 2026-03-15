import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import { getTelegramClient } from "@/lib/telegramManager";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { phoneNumber } = body;
    if (!phoneNumber) {
      return NextResponse.json(
        { error: "Missing phoneNumber" },
        { status: 400 }
      );
    }

    const client = await getTelegramClient(session.user.id);
    const apiId = parseInt(process.env.TELEGRAM_API_ID || "0", 10);
    const apiHash = process.env.TELEGRAM_API_HASH || "";

    if (!apiId || !apiHash) {
      return NextResponse.json(
        { error: "Missing TELEGRAM_API_ID or TELEGRAM_API_HASH" },
        { status: 500 }
      );
    }

    const result = await client.sendCode(
      {
        apiId,
        apiHash,
      },
      phoneNumber
    );

    return NextResponse.json({ phoneCodeHash: result.phoneCodeHash });
  } catch (error: any) {
    console.error(`[Telegram sendCode] Error:`, error);
    return NextResponse.json(
      { error: error.message || "Failed to send code" },
      { status: 400 }
    );
  }
}
