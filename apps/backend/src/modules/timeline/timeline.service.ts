import mongoose from "mongoose";

import { Thread, IThread } from "../../models/Thread";
import { Message, IMessage } from "../../models/Message";
import { connectToDatabase } from "../../lib/db";

export class TimelineService {
  async getThreads(userId: string, limit: number = 20): Promise<IThread[]> {
    await connectToDatabase();

    const userObjectId = new mongoose.Types.ObjectId(userId);

    const threads = await Thread.find({ userId: userObjectId })
      .sort({ lastMessageDate: -1 })
      .limit(limit)
      .lean<IThread[]>();

    return threads;
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
