import mongoose from "mongoose";

import { Thread, IThread } from "@/models/Thread";
import { Message, IMessage } from "@/models/Message";
import { connectToDatabase } from "@/lib/db";

export type ThreadFilter = "all" | "unread" | "archived" | "urgent";

export interface PaginatedThreadsResult {
  threads: IThread[];
  total: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export class TimelineService {
  async getThreads(
    userId: string,
    limit: number = 20,
    cursor?: string,
    filter: ThreadFilter = "all",
    q?: string,
  ): Promise<PaginatedThreadsResult> {
    await connectToDatabase();

    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Build base query
    const baseQuery: any = { userId: userObjectId };

    // Apply filter
    if (filter === "unread") {
      baseQuery.isRead = false;
      baseQuery.isArchived = { $ne: true };
    } else if (filter === "archived") {
      baseQuery.isArchived = true;
    } else if (filter === "urgent") {
      baseQuery.isUrgent = true;
      baseQuery.isArchived = { $ne: true };
      baseQuery.urgentDismissed = { $ne: true };
    } else {
      // "all" — exclude archived from main view
      baseQuery.isArchived = { $ne: true };
    }

    // Apply search (subject + participants, case-insensitive)
    if (q && q.trim()) {
      const regex = new RegExp(
        q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i",
      );
      baseQuery.$and = [
        ...(baseQuery.$and ?? []),
        {
          $or: [
            { subject: regex },
            { participants: regex },
            { snippet: regex },
          ],
        },
      ];
    }

    const query: any = { ...baseQuery };

    // Parse cursor: format is "lastMessageDate_id"
    if (cursor) {
      const underscoreIdx = cursor.lastIndexOf("_");
      const dateStr = cursor.slice(0, underscoreIdx);
      const id = cursor.slice(underscoreIdx + 1);
      const cursorDate = new Date(dateStr);

      query.$and = [
        ...(query.$and ?? []),
        {
          $or: [
            { lastMessageDate: { $lt: cursorDate } },
            {
              lastMessageDate: cursorDate,
              _id: { $lt: new mongoose.Types.ObjectId(id) },
            },
          ],
        },
      ];
    }

    // Fetch threads
    const threads = await Thread.find(query)
      .sort({ lastMessageDate: -1, _id: -1 })
      .limit(limit + 1)
      .lean<IThread[]>();

    const hasNext = threads.length > limit;
    if (hasNext) threads.pop();

    // Total count respects filter + search (not just userId)
    const total = await Thread.countDocuments(baseQuery);

    const hasPrev = !!cursor;

    return { threads, total, hasNext, hasPrev };
  }

  async getThreadDetails(
    userId: string,
    threadId: string,
  ): Promise<{ thread: IThread; messages: IMessage[] } | null> {
    await connectToDatabase();

    const userObjectId = new mongoose.Types.ObjectId(userId);

    const thread = await Thread.findOne({
      id: threadId,
      userId: userObjectId,
    }).lean<IThread | null>();
    if (!thread) {
      return null;
    }

    const threadMongoId = thread._id as unknown as mongoose.Types.ObjectId;

    const messages = await Message.find({
      threadId: threadMongoId,
      userId: userObjectId,
    })
      .sort({ date: 1 })
      .lean<IMessage[]>();

    return { thread, messages };
  }
}
