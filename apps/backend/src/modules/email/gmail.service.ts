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

          const catSenderEmail = firstSenderRaw
            ? GmailService.parseEmail(firstSenderRaw)
            : undefined;

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

          // Unified AI analysis (classification + optional summary) for unclassified threads.
          if (!threadDoc.categorizedAt) {
            const senderCategories = catSenderEmail
              ? await Contact.findOne({
                  userId: new mongoose.Types.ObjectId(this.userId),
                  email: catSenderEmail,
                })
                  .lean()
                  .then((c) => (c ? (c.categories as string[]) : undefined))
                  .catch(() => undefined)
              : undefined;

            const savedMessages = await Message.find({ threadId })
              .sort({ date: 1 })
              .lean();

            aiService
              .analyzeThread({
                thread_id: thread.id!,
                subject: threadDoc.subject,
                snippet: threadDoc.snippet,
                sender_email: catSenderEmail,
                sender_categories: senderCategories,
                messages: savedMessages.map((m) => ({
                  id: m.id,
                  from: m.from || "",
                  to: m.to,
                  sent_at: m.date?.toISOString() || new Date().toISOString(),
                  text: m.body || "",
                })),
              })
              .then((analyzed) =>
                Thread.updateOne(
                  { id: thread.id },
                  {
                    categories: analyzed.categories,
                    noiseFiltered: analyzed.noiseFiltered,
                    categorizedAt: new Date(),
                    categorySource: "ai",
                    ...(analyzed.topicKey
                      ? { topicKey: analyzed.topicKey, topicKeySource: "ai" }
                      : {}),
                    ...(typeof analyzed.topicKeyConfidence === "number"
                      ? { topicKeyConfidence: analyzed.topicKeyConfidence }
                      : {}),
                    ...(analyzed.summary ? { summary: analyzed.summary } : {}),
                  },
                ).then(async () => {
                  if (analyzed.summary) {
                    emitToUser(this.userId, "SUMMARY_READY", {
                      threadId: thread.id!,
                    });
                  }
                }),
              )
              .catch((err) =>
                console.warn("[syncEmails] analyze-thread error:", err.message),
              );
          }
        }),
      );
    }

    // Ensure contacts exist before topic clustering so newly synced threads can
    // be assigned immediately instead of waiting for a later sync cycle.
    if (allParticipants.length > 0) {
      const uniqueParticipants = [...new Set(allParticipants.flat())];
      try {
        await contactService.upsertParticipants(this.userId, uniqueParticipants);
      } catch (err: any) {
        console.warn("[syncEmails] upsertParticipants error:", err.message);
      }
    }

    // ── Post-sync topic work (fire-and-forget) ───────────────────────────────
    if (syncedThreadMetas.length > 0) {
      // Trigger 1 & 2: eligible new threads without a topic → cluster
      // Exclude known noise so low-value filtered threads do not keep
      // re-triggering the topic pipeline toast on later syncs.
      const unassignedIds = syncedThreadMetas
        .filter((m) => !m.topicId)
        .map((m) => m._id);
      const eligibleUnassignedIds =
        unassignedIds.length > 0
          ? await Thread.find({
              _id: { $in: unassignedIds },
              topicId: { $exists: false },
              categorizedAt: { $exists: true },
              noiseFiltered: { $ne: true },
            })
              .select("_id")
              .lean()
              .then((rows) =>
                rows.map((r) => r._id as mongoose.Types.ObjectId),
              )
          : [];

      if (eligibleUnassignedIds.length > 0) {
        const jobId = `topic-pipeline-${Date.now()}`;
        emitToUser(this.userId, "AI_JOB_START", {
          jobId,
          label: `Organizing ${eligibleUnassignedIds.length} thread(s) into topics…`,
        });

        topicService
          .clusterThreadsIntoTopics(this.userId, eligibleUnassignedIds)
          // Consolidate only contacts touched by this batch.
          .then((touchedContactIds) =>
            touchedContactIds.length > 0
              ? topicService.aiConsolidateTopicsForContacts(
                  this.userId,
                  touchedContactIds,
                )
              : Promise.resolve(),
          )
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
    await connectToDatabase();

    const userObjectId = new mongoose.Types.ObjectId(this.userId);
    const existingThread = await Thread.findOne({
      id: gmailThreadId,
      userId: userObjectId,
    })
      .select("isMock")
      .lean();

    const isMockThread =
      !!existingThread?.isMock || gmailThreadId.startsWith("mock-thread-");

    if (!isMockThread) {
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
    }

    // When marking as read, also dismiss from urgent list (Option B: granular flag)
    const update: Record<string, any> = { isRead: read };
    if (read) update.urgentDismissed = true;
    const threadDoc = await Thread.findOneAndUpdate(
      { id: gmailThreadId, userId: userObjectId },
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
    await connectToDatabase();

    const userObjectId = new mongoose.Types.ObjectId(this.userId);
    const existingThread = await Thread.findOne({
      id: gmailThreadId,
      userId: userObjectId,
    })
      .select("isMock")
      .lean();

    const isMockThread =
      !!existingThread?.isMock || gmailThreadId.startsWith("mock-thread-");

    if (!isMockThread) {
      const gmail = await this.getGmailClient();
      await gmail.users.threads.modify({
        userId: "me",
        id: gmailThreadId,
        requestBody: { removeLabelIds: ["INBOX"] },
      });
    }

    const archivedDoc = await Thread.findOneAndUpdate(
      { id: gmailThreadId, userId: userObjectId },
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
    await connectToDatabase();

    const user = await User.findById(this.userId).lean();
    if (!user) throw new Error("User not found");

    // Guard: sandbox/mock thread must never call Gmail API.
    if (params.threadId) {
      const existingThread = await Thread.findOne({
        id: params.threadId,
        userId: new mongoose.Types.ObjectId(this.userId),
      });

      if (existingThread?.isMock) {
        const mockMessageId = `mock-msg-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}`;
        const sentAt = new Date();
        const htmlContent = params.htmlBody ?? params.body ?? "";

        await Message.findOneAndUpdate(
          { id: mockMessageId },
          {
            id: mockMessageId,
            threadId: existingThread._id,
            userId: new mongoose.Types.ObjectId(this.userId),
            isMock: true,
            from: user.email ?? "",
            to: [params.to],
            subject: params.subject,
            body: htmlContent,
            snippet: htmlContent.replace(/<[^>]*>/g, "").slice(0, 100),
            date: sentAt,
            labelIds: [],
          },
          { upsert: true, new: true, setDefaultsOnInsert: true },
        );

        await Thread.updateOne(
          { _id: existingThread._id },
          {
            $set: {
              lastMessageDate: sentAt,
              snippet: htmlContent.replace(/<[^>]*>/g, "").slice(0, 100),
              lastMessageDirection: "outbound",
            },
            $addToSet: { participants: params.to },
          },
        );

        for (const id of params.attachmentIds ?? []) {
          try {
            await unlink(path.join(UPLOAD_DIR, id));
            await unlink(path.join(UPLOAD_DIR, `${id}.json`));
          } catch {
            /* ignore cleanup errors */
          }
        }

        return {
          gmailMessageId: mockMessageId,
          gmailThreadId: existingThread.id,
        };
      }
    }

    const gmail = await this.getGmailClient();

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
