import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Thread } from "@/models/Thread";
import { Message } from "@/models/Message";
import { Contact } from "@/models/Contact";
import { Topic } from "@/models/Topic";
import { TelegramChat } from "@/models/TelegramChat";
import { TelegramMessage } from "@/models/TelegramMessage";

export async function DELETE() {
  try {
    const sandboxApiEnabled =
      process.env.NODE_ENV === "development" ||
      process.env.ENABLE_SANDBOX_API === "true";
    if (!sandboxApiEnabled) {
      return NextResponse.json(
        { error: "Sandbox API is disabled in this environment" },
        { status: 403 },
      );
    }

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session as any).user.id as string | undefined;
    if (!userId) {
      return NextResponse.json({ error: "Missing user id" }, { status: 400 });
    }

    await connectToDatabase();

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const query = { userId: userObjectId, isMock: true };

    const [
      threads,
      messages,
      contacts,
      topics,
      telegramChats,
      telegramMessages,
    ] = await Promise.all([
      Thread.deleteMany(query),
      Message.deleteMany(query),
      Contact.deleteMany(query),
      Topic.deleteMany(query),
      TelegramChat.deleteMany(query),
      TelegramMessage.deleteMany(query),
    ]);

    return NextResponse.json({
      success: true,
      deleted: {
        threads: threads.deletedCount,
        messages: messages.deletedCount,
        contacts: contacts.deletedCount,
        topics: topics.deletedCount,
        telegramChats: telegramChats.deletedCount,
        telegramMessages: telegramMessages.deletedCount,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to clear sandbox data", details: error.message },
      { status: 500 },
    );
  }
}
