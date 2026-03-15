import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import { User } from "@/models/User";
import { connectToDatabase } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();
    const user = await User.findById(session.user.id).lean();

    if (user && user.telegramPhone) {
      return NextResponse.json({ isLinked: true, phone: user.telegramPhone });
    }

    return NextResponse.json({ isLinked: false });
  } catch (error: any) {
    console.error("[Telegram status GET] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
