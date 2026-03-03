import { google, gmail_v1 } from "googleapis";
import mongoose from "mongoose";
import { readFile, unlink } from "fs/promises";
import path from "path";

import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";
import { Thread } from "@/models/Thread";
import { Message } from "@/models/Message";
import { ContactService } from "@/modules/contacts/contact.service";

const UPLOAD_DIR = "/tmp/email-attachments";
const contactService = new ContactService();

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
      redirectUri,
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

    // Fetch all thread details in parallel batches of 10 to avoid rate limits
    const BATCH_SIZE = 10;
    const allParticipants: string[][] = [];

    for (let i = 0; i < threads.length; i += BATCH_SIZE) {
      const batch = threads.slice(i, i + BATCH_SIZE).filter((t) => !!t.id);

      const results = await Promise.allSettled(
        batch.map((threadMeta) =>
          gmail.users.threads.get({
            userId: "me",
            id: threadMeta.id!,
            // "metadata" is faster – only headers, no full bodies on list
            // But we still need bodies for messages, so use "full"
            format: "full",
          }),
        ),
      );

      // Process DB writes in parallel per batch
      await Promise.allSettled(
        results.map(async (result) => {
          if (result.status === "rejected" || !result.value.data.id) return;

          const thread = result.value.data;

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
              toRaw
                .split(",")
                .forEach((email) => participants.add(email.trim()));
            }
            if (!threadSubject && subject) threadSubject = subject;
            if (msg.snippet) threadSnippet = msg.snippet;
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
                      10,
                    ),
                  )
                : undefined,
            },
            { upsert: true, new: true, setDefaultsOnInsert: true },
          );

          allParticipants.push(Array.from(participants));

          const threadId = threadDoc._id;

          // Upsert all messages in this thread in parallel
          const msgResults = await Promise.allSettled(
            (thread.messages || [])
              .filter((m) => !!m.id)
              .map(async (msg) => {
                const headers = msg.payload?.headers || [];
                const getHeader = (name: string) =>
                  headers.find(
                    (h) => h.name?.toLowerCase() === name.toLowerCase(),
                  )?.value || "";

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
                  { upsert: true, new: true, setDefaultsOnInsert: true },
                );
              }),
          );

          syncedMessages += msgResults.filter(
            (r) => r.status === "fulfilled",
          ).length;
        }),
      );
    }

    // Batch upsert all participants once after all threads are processed
    if (allParticipants.length > 0) {
      const uniqueParticipants = [...new Set(allParticipants.flat())];
      // Fire-and-forget – don't block sync response on contact upserts
      contactService
        .upsertParticipants(this.userId, uniqueParticipants)
        .catch((err) =>
          console.warn("[syncEmails] upsertParticipants error:", err.message),
        );
    }

    // Store nextPageToken for future syncs
    const nextPageToken = listRes.data.nextPageToken ?? undefined;
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

  public async markRead(gmailThreadId: string, read: boolean): Promise<void> {
    const gmail = await this.getGmailClient();
    if (read) {
      await gmail.users.threads.modify({
        userId: "me",
        id: gmailThreadId,
        requestBody: { removeLabelIds: ["UNREAD"] },
      });
    } else {
      await gmail.users.threads.modify({
        userId: "me",
        id: gmailThreadId,
        requestBody: { addLabelIds: ["UNREAD"] },
      });
    }
    await Thread.findOneAndUpdate({ id: gmailThreadId }, { isRead: read });
  }

  public async archiveThread(gmailThreadId: string): Promise<void> {
    const gmail = await this.getGmailClient();
    await gmail.users.threads.modify({
      userId: "me",
      id: gmailThreadId,
      requestBody: { removeLabelIds: ["INBOX"] },
    });
    await Thread.findOneAndUpdate({ id: gmailThreadId }, { isArchived: true });
  }

  public async sendEmail(params: {
    to: string;
    subject: string;
    /** Plain text fallback (for backwards compat) */
    body?: string;
    /** HTML body from Tiptap – takes precedence over body */
    htmlBody?: string;
    /** IDs returned by POST /api/emails/attachments */
    attachmentIds?: string[];
    threadId?: string; // Gmail thread ID to reply into
  }): Promise<{ gmailMessageId: string; gmailThreadId: string }> {
    const gmail = await this.getGmailClient();
    await connectToDatabase();

    const user = await User.findById(this.userId).lean();
    if (!user) throw new Error("User not found");

    const htmlContent = params.htmlBody ?? params.body ?? "";
    const fromHeader = user.email;
    const threadHeader = params.threadId
      ? `\r\nIn-Reply-To: ${params.threadId}`
      : "";

    // Load attachment metadata from disk
    type AttachmentInfo = { name: string; mimeType: string; data: Buffer };
    const attachments: AttachmentInfo[] = [];
    for (const id of params.attachmentIds ?? []) {
      try {
        const metaPath = path.join(UPLOAD_DIR, `${id}.json`);
        const meta = JSON.parse(await readFile(metaPath, "utf-8")) as {
          name: string;
          mimeType: string;
          path: string;
        };
        const data = await readFile(meta.path);
        attachments.push({ name: meta.name, mimeType: meta.mimeType, data });
      } catch {
        /* skip missing attachments (already cleaned up, etc.) */
      }
    }

    let mime: string;

    if (attachments.length === 0) {
      // Simple single-part HTML message
      mime = [
        `From: ${fromHeader}`,
        `To: ${params.to}`,
        `Subject: ${params.subject}`,
        `MIME-Version: 1.0`,
        `Content-Type: text/html; charset="UTF-8"`,
        `Content-Transfer-Encoding: 7bit`,
        threadHeader,
        ``,
        htmlContent,
      ]
        .filter((line) => line !== undefined)
        .join("\r\n");
    } else {
      // Multipart/mixed for attachments
      const boundary = `----=_Part_${crypto.randomUUID().replace(/-/g, "")}`;
      const parts: string[] = [
        `--${boundary}`,
        `Content-Type: text/html; charset="UTF-8"`,
        `Content-Transfer-Encoding: 7bit`,
        ``,
        htmlContent,
      ];
      for (const att of attachments) {
        const b64 = att.data.toString("base64").replace(/.{76}/g, "$&\r\n");
        parts.push(
          `--${boundary}`,
          `Content-Type: ${att.mimeType}; name="${att.name}"`,
          `Content-Transfer-Encoding: base64`,
          `Content-Disposition: attachment; filename="${att.name}"`,
          ``,
          b64,
        );
      }
      parts.push(`--${boundary}--`);

      mime = [
        `From: ${fromHeader}`,
        `To: ${params.to}`,
        `Subject: ${params.subject}`,
        `MIME-Version: 1.0`,
        `Content-Type: multipart/mixed; boundary="${boundary}"`,
        threadHeader,
        ``,
        parts.join("\r\n"),
      ]
        .filter((line) => line !== undefined)
        .join("\r\n");
    }

    const encoded = Buffer.from(mime)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const res = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: encoded,
        threadId: params.threadId || undefined,
      },
    });

    const msgId = res.data.id!;
    const gThreadId = res.data.threadId!;

    // Clean up temp attachment files
    for (const id of params.attachmentIds ?? []) {
      try {
        await unlink(path.join(UPLOAD_DIR, id));
        await unlink(path.join(UPLOAD_DIR, `${id}.json`));
      } catch {
        /* ignore cleanup errors */
      }
    }

    // Fetch the sent message to upsert in DB
    const msgRes = await gmail.users.messages.get({
      userId: "me",
      id: msgId,
      format: "full",
    });

    const msg = msgRes.data;
    const headers = msg.payload?.headers || [];
    const getHeader = (name: string) =>
      headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())
        ?.value || "";

    // Upsert Thread
    const threadDoc = await Thread.findOneAndUpdate(
      { id: gThreadId },
      {
        id: gThreadId,
        userId: new mongoose.Types.ObjectId(this.userId),
        subject: getHeader("Subject") || params.subject,
        participants: [params.to, fromHeader ?? ""],
        snippet:
          msg.snippet || htmlContent.replace(/<[^>]*>/g, "").slice(0, 100),
        lastMessageDate: msg.internalDate
          ? new Date(parseInt(msg.internalDate, 10))
          : new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    const body = extractMessageBody(msg.payload);
    await Message.findOneAndUpdate(
      { id: msgId },
      {
        id: msgId,
        threadId: threadDoc._id,
        userId: new mongoose.Types.ObjectId(this.userId),
        from: fromHeader ?? "",
        to: [params.to],
        subject: getHeader("Subject") || params.subject,
        body,
        snippet: msg.snippet,
        date: msg.internalDate
          ? new Date(parseInt(msg.internalDate, 10))
          : new Date(),
        labelIds: msg.labelIds || [],
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    return { gmailMessageId: msgId, gmailThreadId: gThreadId };
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
  mimeType: string,
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
    "base64",
  );
  return buff.toString("utf-8");
}
