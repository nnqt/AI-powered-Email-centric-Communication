import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import { getTelegramClient } from "@/lib/telegramManager";
import { Api } from "telegram";
import { User } from "@/models/User";
import { connectToDatabase } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { phoneNumber, phoneCodeHash, code } = body;
    if (!phoneNumber || !phoneCodeHash || !code) {
      return NextResponse.json(
        { error: "Missing required fields" },
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

    try {
      await client.invoke(
        new Api.auth.SignIn({
          phoneNumber,
          phoneCodeHash,
          phoneCode: code,
        })
      );
    } catch (err: any) {
      console.error("[Telegram check OTP Error]", err);
      throw new Error(err.message || "Invalid OTP code");
    }

    // Save session string and telegram phone to DB
    const stringSession = client.session.save() as unknown as string;

    await connectToDatabase();
    await User.findByIdAndUpdate(session.user.id, {
      telegramSession: stringSession,
      telegramPhone: phoneNumber,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error(`[Telegram verifyCode] Error:`, error);
    return NextResponse.json(
      { error: error.message || "Verification failed" },
      { status: 400 }
    );
  }
}
