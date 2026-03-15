import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";

import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Contact } from "@/models/Contact";
import { Thread } from "@/models/Thread";
import { TelegramMessage } from "@/models/TelegramMessage";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = (session as any).user.id as string;

    await connectToDatabase();
    const contact = await Contact.findOne({
      _id: new mongoose.Types.ObjectId(id),
      userId: new mongoose.Types.ObjectId(userId),
    }).lean<any>();

    if (!contact) {
      return NextResponse.json(
        { error: "Contact not found" },
        { status: 404 },
      );
    }

    const emails = [contact.email, ...contact.alternateEmails].map((e) =>
      e.toLowerCase(),
    );

    // Build email match patterns
    const emailPatterns = emails
      .map((e) => `(?:^|<)${e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:>|$)`)
      .join("|");

    const [threads, tgMessages] = await Promise.all([
      // Fetch threads
      Thread.find({
        userId: new mongoose.Types.ObjectId(userId),
        participants: {
          $elemMatch: { $regex: emailPatterns, $options: "i" },
        },
      })
        .sort({ lastMessageDate: -1 })
        .limit(50)
        .lean<any[]>(),

      // Fetch telegram
      contact.telegramId
        ? TelegramMessage.find({
            userId,
            $or: [
              { senderId: contact.telegramId },
              // In private chats, chatId is often the partner's user ID
              { chatId: contact.telegramId },
            ]
          })
            .sort({ date: -1 })
            .limit(50)
            .lean<any[]>()
        : Promise.resolve([]),
    ]);

    const timeline: any[] = [];

    // Map threads
    threads.forEach((t) => {
      timeline.push({
        type: "email",
        id: t._id.toString(),
        threadId: t.threadId,
        date: t.lastMessageDate,
        isOutbound: false, // Threads don't easily map to a single out/in state without deep inspection
        subject: t.subject,
        snippet: t.snippet,
      });
    });

    // Map telegram
    tgMessages.forEach((m) => {
      timeline.push({
        type: "telegram",
        id: m.messageId,
        date: m.date,
        isOutbound: m.isOutbound,
        text: m.text,
        chatId: m.chatId,
        senderId: m.senderId,
      });
    });

    // Sort by date descending
    timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json({ timeline });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Internal server error", details: err.message },
      { status: 500 },
    );
  }
}
