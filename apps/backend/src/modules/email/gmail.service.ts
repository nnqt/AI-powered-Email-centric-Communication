import { google, gmail_v1 } from "googleapis";
import mongoose from "mongoose";

import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";
import { Thread } from "@/models/Thread";
import { Message } from "@/models/Message";

export class GmailService {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  private async getGmailClient(): Promise<gmail_v1.Gmail> {
    await connectToDatabase();

    const user = await User.findById(this.userId).lean();
    if (!user || !user.refreshToken) {
      const error = new Error("No refresh token found for user");
      (error as any).code = "UNAUTHORIZED";
      throw error;
    }

    const clientId = process.env.GOOGLE_CLIENT_ID || "";
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || undefined;

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    oauth2Client.setCredentials({ refresh_token: user.refreshToken });

    return google.gmail({ version: "v1", auth: oauth2Client });
  }

  public async syncEmails(pageToken?: string): Promise<{
    syncedMessages: number;
    nextPageToken?: string;
    hasMore: boolean;
  }> {
    const gmail = await this.getGmailClient();

    // List threads with pagination (50 per batch for better UX)
    const listRes = await gmail.users.threads.list({
      userId: "me",
      maxResults: 50,
      pageToken: pageToken || undefined,
    });

    const threads = listRes.data.threads || [];
    let syncedMessages = 0;

    for (const threadMeta of threads) {
      if (!threadMeta.id) continue;

      const threadRes = await gmail.users.threads.get({
        userId: "me",
        id: threadMeta.id,
        format: "full",
      });

      const thread = threadRes.data;
      if (!thread.id) continue;

      // Extract participants, subject, and snippet from messages
      const participants = new Set<string>();
      let threadSubject = "";
      let threadSnippet = "";
      
      for (const msg of thread.messages || []) {
        const headers = msg.payload?.headers || [];
        const getHeader = (name: string) =>
          headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())
            ?.value || "";
        
        const from = getHeader("From");
        const toRaw = getHeader("To");
        const subject = getHeader("Subject");
        
        if (from) participants.add(from);
        if (toRaw) {
          toRaw.split(",").forEach((email) => participants.add(email.trim()));
        }
        
        if (!threadSubject && subject) {
          threadSubject = subject;
        }
        
        // Use message snippet as thread snippet (from last message)
        if (msg.snippet) {
          threadSnippet = msg.snippet;
        }
      }

      const threadDoc = await Thread.findOneAndUpdate(
        { id: thread.id },
        {
          id: thread.id,
          userId: new mongoose.Types.ObjectId(this.userId),
          historyId: thread.historyId,
          snippet: thread.snippet || threadSnippet,
          participants: Array.from(participants),
          subject: threadSubject,
          lastMessageDate: thread.messages?.[thread.messages.length - 1]
            ?.internalDate
            ? new Date(
                parseInt(
                  thread.messages[thread.messages.length - 1].internalDate!,
                  10
                )
              )
            : undefined,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      const threadId = threadDoc._id;

      for (const msg of thread.messages || []) {
        if (!msg.id) continue;

        const headers = msg.payload?.headers || [];
        const getHeader = (name: string) =>
          headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())
            ?.value || "";

        const subject = getHeader("Subject");
        const from = getHeader("From");
        const toRaw = getHeader("To");
        const to = toRaw ? toRaw.split(",").map((t) => t.trim()) : [];

        const body = extractMessageBody(msg.payload);

        await Message.findOneAndUpdate(
          { id: msg.id },
          {
            id: msg.id,
            threadId,
            userId: new mongoose.Types.ObjectId(this.userId),
            from,
            to,
            subject,
            body,
            snippet: msg.snippet,
            date: msg.internalDate
              ? new Date(parseInt(msg.internalDate, 10))
              : undefined,
            labelIds: msg.labelIds || [],
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        syncedMessages += 1;
      }
    }

    // Store nextPageToken for future syncs
    const nextPageToken = listRes.data.nextPageToken;
    const hasMore = !!nextPageToken;

    await User.findByIdAndUpdate(this.userId, {
      gmailNextPageToken: nextPageToken || null,
      gmailSyncComplete: !hasMore,
    });

    return {
      syncedMessages,
      nextPageToken,
      hasMore,
    };
  }
}

function extractMessageBody(payload?: gmail_v1.Schema$MessagePart): string {
  if (!payload) return "";

  const parts = payload.parts || [];

  // Prefer HTML parts
  const htmlPart = findPartByMimeType(parts, "text/html");
  if (htmlPart?.body?.data) {
    return decodeBase64Url(htmlPart.body.data);
  }

  // Fallback to text/plain
  const textPart = findPartByMimeType(parts, "text/plain");
  if (textPart?.body?.data) {
    return decodeBase64Url(textPart.body.data);
  }

  // Single-part message
  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  return "";
}

function findPartByMimeType(
  parts: gmail_v1.Schema$MessagePart[],
  mimeType: string
): gmail_v1.Schema$MessagePart | undefined {
  for (const part of parts) {
    if (part.mimeType === mimeType) return part;
    if (part.parts?.length) {
      const found = findPartByMimeType(part.parts, mimeType);
      if (found) return found;
    }
  }
  return undefined;
}

function decodeBase64Url(data: string): string {
  const buff = Buffer.from(
    data.replace(/-/g, "+").replace(/_/g, "/"),
    "base64"
  );
  return buff.toString("utf-8");
}
