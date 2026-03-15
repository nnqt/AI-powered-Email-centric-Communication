import { google, gmail_v1 } from "googleapis";
import mongoose from "mongoose";
import { readFile, unlink } from "fs/promises";
import path from "path";

import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";
import { Thread } from "@/models/Thread";
import { Message } from "@/models/Message";
import { Contact } from "@/models/Contact";
import {
  ContactService,
  decodeEmailHeader,
} from "@/modules/contacts/contact.service";
import { AIService } from "@/modules/ai/ai.service";
import { TopicService } from "@/modules/topics/topic.service";
import { emitToUser } from "@/lib/socketServer";

const UPLOAD_DIR = "/tmp/email-attachments";
const contactService = new ContactService();
const aiService = new AIService();
const topicService = new TopicService();

export class GmailService {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  private async getUserEmail(): Promise<string | undefined> {
    await connectToDatabase();
    const user = await User.findById(this.userId).lean();
    return user?.email?.toLowerCase();
  }

  /** Parse raw "Display Name <email@domain>" → lowercase email only */
  private static parseEmail(raw: string): string {
    const match = raw.match(/<([^>]+)>/);
    return (match ? match[1] : raw).trim().toLowerCase();
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
    const userEmail = await this.getUserEmail();

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

    // Collect thread docs for post-sync topic clustering (Trigger 1, 2, 3)
    interface SyncedThreadMeta {
      _id: mongoose.Types.ObjectId;
      topicId?: mongoose.Types.ObjectId;
      lastMessageDirection: "inbound" | "outbound";
      lastInboundAt?: Date;
      lastMessageDate?: Date;
    }
    const syncedThreadMetas: SyncedThreadMeta[] = [];

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
          let firstSenderRaw = "";
          let lastSenderRaw = "";
          let lastInboundAt: Date | undefined;

          for (const msg of thread.messages || []) {
            const headers = msg.payload?.headers || [];
            const getHeader = (name: string) =>
              headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())
                ?.value || "";

            const from = decodeEmailHeader(getHeader("From"));
            const toRaw = getHeader("To");
            const subject = getHeader("Subject");

            if (from) participants.add(from);
            if (!firstSenderRaw && from) firstSenderRaw = from;
            if (from) lastSenderRaw = from;
            // Track last inbound timestamp (message FROM contact, not from user)
            if (from && msg.internalDate) {
              const fromEmail = GmailService.parseEmail(from);
              if (!userEmail || fromEmail !== userEmail) {
                const msgDate = new Date(parseInt(msg.internalDate, 10));
                if (!lastInboundAt || msgDate > lastInboundAt) {
                  lastInboundAt = msgDate;
                }
              }
            }
            if (toRaw) {
              toRaw
                .split(",")
                .forEach((email) => participants.add(email.trim()));
            }
            if (!threadSubject && subject) threadSubject = subject;
            if (msg.snippet) threadSnippet = msg.snippet;
          }

          // Determine last message direction (inbound = from contact, outbound = from user)
          const lastSenderEmail = lastSenderRaw
            ? GmailService.parseEmail(lastSenderRaw)
            : undefined;
          const lastMessageDirection: "inbound" | "outbound" =
            lastSenderEmail && userEmail && lastSenderEmail === userEmail
              ? "outbound"
              : "inbound";

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
              lastMessageDirection,
              ...(lastInboundAt ? { lastInboundAt } : {}),
            },
            { upsert: true, new: true, setDefaultsOnInsert: true },
          );

          // Fire-and-forget: thread category classification (if not yet classified)
          if (!threadDoc.categorizedAt) {
            const catSenderEmail = firstSenderRaw
              ? GmailService.parseEmail(firstSenderRaw)
              : undefined;

            const catContactLookup = catSenderEmail
              ? Contact.findOne({
                  userId: new mongoose.Types.ObjectId(this.userId),
                  email: catSenderEmail,
                })
                  .lean()
                  .then((c) => (c ? (c.categories as string[]) : undefined))
                  .catch(() => undefined)
              : Promise.resolve(undefined);

            catContactLookup
              .then((senderCategories) =>
                aiService.classifyThreadCategory(
                  thread.id!,
                  threadDoc.subject,
                  threadDoc.snippet,
                  catSenderEmail,
                  senderCategories,
                ),
              )
              .then(({ categories, noiseFiltered }) =>
                Thread.updateOne(
                  { id: thread.id },
                  {
                    categories,
                    noiseFiltered,
                    categorizedAt: new Date(),
                    categorySource: "ai",
                  },
                ),
              )
              .catch((err) =>
                console.warn(
                  "[syncEmails] classify-thread-category error:",
                  err.message,
                ),
              );
          }

          // Fire-and-forget urgent classification for unclassified threads
          if (!threadDoc.urgentClassifiedAt) {
            // Lookup sender contact to get categories for context-aware classification
            const senderEmail = firstSenderRaw
              ? firstSenderRaw.match(/<([^>]+)>/)?.[1]?.toLowerCase() ||
                firstSenderRaw.trim().toLowerCase()
              : undefined;

            const senderLookup = senderEmail
              ? Contact.findOne({
                  userId: new mongoose.Types.ObjectId(this.userId),
                  email: senderEmail,
                })
                  .lean()
                  .then((c) => (c ? (c.categories as string[]) : undefined))
                  .catch(() => undefined)
              : Promise.resolve(undefined);

            senderLookup
              .then((senderCategories) =>
                aiService.classifyUrgent(
                  thread.id!,
                  threadDoc.subject,
                  threadDoc.snippet,
                  senderEmail,
                  senderCategories,
                ),
              )
              .then(({ isUrgent }) =>
                Thread.updateOne(
                  { id: thread.id },
                  { isUrgent, urgentClassifiedAt: new Date() },
                ),
              )
              .catch((err) =>
                console.warn(
                  "[syncEmails] classify-urgent error:",
                  err.message,
                ),
              );
          }

          // Collect for post-sync topic work
          syncedThreadMetas.push({
            _id: threadDoc._id as mongoose.Types.ObjectId,
            topicId: threadDoc.topicId as mongoose.Types.ObjectId | undefined,
            lastMessageDirection,
            lastInboundAt,
            lastMessageDate: threadDoc.lastMessageDate,
          });

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
                const from = decodeEmailHeader(getHeader("From"));
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

    // ── Post-sync topic work (fire-and-forget) ───────────────────────────────
    if (syncedThreadMetas.length > 0) {
      // Trigger 1 & 2: new threads without a topic → cluster
      const unassignedIds = syncedThreadMetas
        .filter((m) => !m.topicId)
        .map((m) => m._id);

      if (unassignedIds.length > 0) {
        const jobId = `topic-pipeline-${Date.now()}`;
        emitToUser(this.userId, "AI_JOB_START", {
          jobId,
          label: `Organizing ${unassignedIds.length} thread(s) into topics…`,
        });

        topicService
          .clusterThreadsIntoTopics(this.userId, unassignedIds)
          // Phase 3: after clustering, label any unlabeled topics for this user
          .then(() => topicService.labelUnlabeledTopics(this.userId))
          // Phase 4: re-score all topics after cluster+label pipeline
          .then(() => topicService.scoreAllTopicsForUser(this.userId))
          .then(() =>
            emitToUser(this.userId, "AI_JOB_DONE", {
              jobId,
              label: "Topics organized & scored",
              success: true,
            }),
          )
          .catch((err) => {
            emitToUser(this.userId, "AI_JOB_DONE", {
              jobId,
              label: "Topic organization failed",
              success: false,
            });
            console.warn(
              "[syncEmails] topic cluster/label/score error:",
              err.message,
            );
          });
      }

      // Trigger 3: existing threads that already belong to a topic → update timing + re-score
      const assignedMetas = syncedThreadMetas.filter((m) => m.topicId);
      for (const meta of assignedMetas) {
        topicService
          .updateTopicOnNewMessage(
            meta.topicId!,
            meta.lastMessageDirection,
            meta.lastInboundAt ?? meta.lastMessageDate ?? new Date(),
          )
          .then(() => topicService.scoreTopicById(meta.topicId!))
          .catch((err) =>
            console.warn(
              "[syncEmails] updateTopicOnNewMessage error:",
              err.message,
            ),
          );
      }
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
    // When marking as read, also dismiss from urgent list (Option B: granular flag)
    const update: Record<string, any> = { isRead: read };
    if (read) update.urgentDismissed = true;
    const threadDoc = await Thread.findOneAndUpdate(
      { id: gmailThreadId },
      update,
    );

    // Trigger 4: re-score the topic when user marks a thread as read
    // (unansweredCount may change once the thread's direction is re-evaluated)
    if (threadDoc?.topicId) {
      topicService
        .scoreTopicById(threadDoc.topicId)
        .catch((err) =>
          console.warn("[markRead] scoreTopicById error:", err.message),
        );
    }
  }

  public async archiveThread(gmailThreadId: string): Promise<void> {
    const gmail = await this.getGmailClient();
    await gmail.users.threads.modify({
      userId: "me",
      id: gmailThreadId,
      requestBody: { removeLabelIds: ["INBOX"] },
    });
    const archivedDoc = await Thread.findOneAndUpdate(
      { id: gmailThreadId },
      { isArchived: true },
    );

    // Trigger 5: archiving a thread affects unansweredCount → re-score
    if (archivedDoc?.topicId) {
      topicService
        .scoreTopicById(archivedDoc.topicId)
        .catch((err) =>
          console.warn("[archiveThread] scoreTopicById error:", err.message),
        );
    }
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
