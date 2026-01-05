import mongoose from "mongoose";

import { Thread, IThread } from "@/models/Thread";
import { Message, IMessage } from "@/models/Message";
import { connectToDatabase } from "@/lib/db";

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
    cursor?: string
  ): Promise<PaginatedThreadsResult> {
    await connectToDatabase();

    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Build query
    const query: any = { userId: userObjectId };

    // Parse cursor: format is "lastMessageDate_id"
    if (cursor) {
      const [dateStr, id] = cursor.split("_");
      const cursorDate = new Date(dateStr);

      // Find threads older than cursor (for "Older" button)
      query.$or = [
        { lastMessageDate: { $lt: cursorDate } },
        {
          lastMessageDate: cursorDate,
          _id: { $lt: new mongoose.Types.ObjectId(id) },
        },
      ];
    }

    // Fetch threads
    const threads = await Thread.find(query)
      .sort({ lastMessageDate: -1, _id: -1 })
      .limit(limit + 1) // Fetch one extra to check if there's next page
      .lean<IThread[]>();

    // Check if there are more threads
    const hasNext = threads.length > limit;
    if (hasNext) {
      threads.pop(); // Remove the extra thread
    }

    // Get total count (cached for performance)
    const total = await Thread.countDocuments({ userId: userObjectId });

    // Check if there's a previous page (simple heuristic: cursor exists)
    const hasPrev = !!cursor;

    return {
      threads,
      total,
      hasNext,
      hasPrev,
    };
  }

  async getThreadDetails(
    userId: string,
    threadId: string
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
