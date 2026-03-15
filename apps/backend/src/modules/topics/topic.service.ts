import mongoose from "mongoose";

import { connectToDatabase } from "@/lib/db";
import { Thread, IThread } from "@/models/Thread";
import { Topic, ITopic } from "@/models/Topic";
import { Contact, IContact } from "@/models/Contact";
import { User } from "@/models/User";
import { AIService } from "@/modules/ai/ai.service";

// ── Subject helpers ──────────────────────────────────────────────────────────

// Prefixes to strip before comparing subjects (case-insensitive).
const _SUBJECT_PREFIX_RE = /^(re|fwd?|fw|tr|r|sv|antw|aw|rép|enc):\s*/i;

/**
 * Strip reply/forward prefixes (handles multi-level "Re: Re: ...")
 * and remove [TAG] style brackets from the beginning.
 */
export function normalizeSubject(subject: string): string {
  let s = subject.trim();

  // Strip multi-level prefixes: Re: Fwd: Re: …
  let prev = "";
  while (s !== prev) {
    prev = s;
    s = s.replace(_SUBJECT_PREFIX_RE, "").trim();
  }

  // Strip leading bracket tags like [EXTERNAL], [EXT], [SPAM], [TICKET-123]
  s = s.replace(/^\s*\[[^\]]{0,40}\]\s*/g, "").trim();

  // Collapse repeated spaces
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Return true when two normalized subjects likely refer to the same topic.
 * Rules (applied in order):
 *  1. Exact match after lower-casing.
 *  2. One is a substring of the other (handles minor rewording).
 *  3. Shared meaningful words >= 60 % of the larger word set.
 */
export function subjectMatchesTopic(
  normalizedA: string,
  normalizedB: string,
): boolean {
  const a = normalizedA.toLowerCase();
  const b = normalizedB.toLowerCase();
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;

  // Word-overlap check — only words with > 2 chars (ignore stop words like "a", "in", "of")
  const wordsA = a.split(/\s+/).filter((w) => w.length > 2);
  const setB = new Set(b.split(/\s+/).filter((w) => w.length > 2));
  if (wordsA.length === 0 || setB.size === 0) return false;

  const overlap = wordsA.filter((w) => setB.has(w)).length;
  return overlap / Math.max(wordsA.length, setB.size) >= 0.6;
}

// ── Email parsing helper ─────────────────────────────────────────────────────

/** Parse "Display Name <email@domain>" or "email@domain" → lowercase email. */
function parseEmail(raw: string): string {
  const match = raw.match(/<([^>]+)>/);
  return (match ? match[1] : raw).trim().toLowerCase();
}

// ── Topic DTO ────────────────────────────────────────────────────────────────

export interface ChatInsightDTO {
  _id: string;
  intent: string;
  summary: string;
  sourceChatId: string;
  date: string;
}

export interface TopicDTO {
  _id: string;
  contactId: string;
  name: string;
  nameEditedByUser: boolean;
  threadCount: number;
  unansweredCount: number;
  focusScore: number;
  lastInboundAt?: string;
  lastOutboundAt?: string;
  aiLabeled: boolean;
  chatInsights?: ChatInsightDTO[];
  createdAt: string;
  updatedAt: string;
}

export interface FocusTopicDTO extends TopicDTO {
  contact: {
    _id: string;
    email: string;
    name?: string;
    org?: string;
    category: string;
    categories: string[];
  };
}

function toTopicDTO(t: ITopic): TopicDTO {
  const doc = t as any;
  return {
    _id: doc._id.toString(),
    contactId: t.contactId.toString(),
    name: t.name,
    nameEditedByUser: t.nameEditedByUser,
    threadCount: t.threadCount,
    unansweredCount: t.unansweredCount,
    focusScore: t.focusScore,
    lastInboundAt: t.lastInboundAt?.toISOString(),
    lastOutboundAt: t.lastOutboundAt?.toISOString(),
    aiLabeled: t.aiLabeled,
    chatInsights: doc.chatInsights?.map((insight: any) => ({
      _id: insight._id?.toString() ?? "",
      intent: insight.intent,
      summary: insight.summary,
      sourceChatId: insight.sourceChatId,
      date: insight.date?.toISOString() ?? "",
    })),
    createdAt: doc.createdAt?.toISOString(),
    updatedAt: doc.updatedAt?.toISOString(),
  };
}

// ── Focus score formula ───────────────────────────────────────────────────────
//
// focusScore = unansweredCount × 40            (primary signal)
//            + recencyScore(lastInboundAt)      (0–30, exponential decay)
//            + contactWeight                    (0–10, based on relationship)
//
// Max theoretical: unlimited unanswered (capped in practice), 30 recency, 10 weight.
// The score is stored on the Topic document and re-computed after each sync event.

function _recencyScore(lastInboundAt: Date | undefined): number {
  if (!lastInboundAt) return 0;
  const ageHours = (Date.now() - lastInboundAt.getTime()) / 3_600_000;
  if (ageHours < 6) return 30;
  if (ageHours < 24) return 24;
  if (ageHours < 72) return 18;
  if (ageHours < 168) return 9;
  if (ageHours < 720) return 3;
  return 0;
}

function _contactWeight(category: string | undefined): number {
  if (category === "colleague" || category === "customer") return 10;
  if (category === "spam") return 0;
  return 5; // other | unknown | undefined
}

export function computeFocusScore(params: {
  unansweredCount: number;
  lastInboundAt?: Date;
  contactCategory?: string;
  chatInsights?: any[];
}): number {
  let latestDate = params.lastInboundAt;
  
  if (params.chatInsights?.length) {
    const latestInsightDate = new Date(Math.max(...params.chatInsights.map(i => new Date(i.date).getTime())));
    if (!latestDate || latestInsightDate > latestDate) {
      latestDate = latestInsightDate;
    }
  }

  return Math.round(
    params.unansweredCount * 40 +
      _recencyScore(latestDate) +
      _contactWeight(params.contactCategory),
  );
}

// ── Core service ─────────────────────────────────────────────────────────────

export class TopicService {
  /**
   * Cluster a batch of newly-synced threads into topics.
   *
   * @param userId       Owner user id (string)
   * @param threadDocIds MongoDB _id values (ObjectId | string) of threads to process.
   *
   * - Threads with noiseFiltered=true are skipped entirely.
   * - Threads that already have a topicId are skipped.
   * - Remaining threads are matched against existing active topics for the
   *   same contact (30-day window) by subject similarity.
   * - Unmatched threads create a new Topic with a temporary name.
   */
  async clusterThreadsIntoTopics(
    userId: string,
    threadDocIds: (mongoose.Types.ObjectId | string)[],
  ): Promise<void> {
    if (threadDocIds.length === 0) return;
    await connectToDatabase();

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const objectIds = threadDocIds.map((id) =>
      id instanceof mongoose.Types.ObjectId
        ? id
        : new mongoose.Types.ObjectId(id),
    );

    // Fetch the user's email (needed to identify "main contact" = not the user)
    const userDoc = await User.findById(userId).lean();
    const userEmail = userDoc?.email?.toLowerCase();

    // Fetch all target threads in one query — exclude noise + already assigned
    const threads = await Thread.find({
      _id: { $in: objectIds },
      noiseFiltered: { $ne: true },
      topicId: { $exists: false },
    }).lean();

    if (threads.length === 0) return;

    // Build set of contact emails we need to look up
    const emailSet = new Set<string>();
    for (const t of threads) {
      const contactEmail = this._primaryContactEmail(
        t.participants ?? [],
        userEmail,
      );
      if (contactEmail) emailSet.add(contactEmail);
    }

    // Bulk fetch contacts (userId + email match)
    const contactsRaw = await Contact.find({
      userId: userObjectId,
      email: { $in: Array.from(emailSet) },
    })
      .lean()
      .then((docs) => Object.fromEntries(docs.map((c) => [c.email, c])));

    // Fetch active topics for this user created / active within 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const activeTopics = await Topic.find({
      userId: userObjectId,
      $or: [
        { createdAt: { $gte: thirtyDaysAgo } },
        { lastInboundAt: { $gte: thirtyDaysAgo } },
        { lastOutboundAt: { $gte: thirtyDaysAgo } },
      ],
    }).lean();

    // Group active topics by contactId string for fast lookup
    const topicsByContact = new Map<string, ITopic[]>();
    for (const topic of activeTopics) {
      const key = topic.contactId.toString();
      if (!topicsByContact.has(key)) topicsByContact.set(key, []);
      topicsByContact.get(key)!.push(topic as unknown as ITopic);
    }

    // Process each thread sequentially to avoid race conditions on topic creation
    for (const thread of threads) {
      try {
        await this._assignThread(
          thread as unknown as IThread,
          userObjectId,
          userEmail,
          contactsRaw,
          topicsByContact,
        );
      } catch (err: any) {
        console.warn("[topic.service] _assignThread error:", err.message);
      }
    }
  }

  /**
   * Called when a new message arrives inside an already-existing thread.
   * Updates the topic's denormalized timing fields and unansweredCount.
   */
  async updateTopicOnNewMessage(
    topicId: mongoose.Types.ObjectId | string,
    direction: "inbound" | "outbound",
    messageDate: Date,
  ): Promise<void> {
    await connectToDatabase();

    const id =
      topicId instanceof mongoose.Types.ObjectId
        ? topicId
        : new mongoose.Types.ObjectId(topicId);

    const update: Record<string, any> = {};

    if (direction === "inbound") {
      // Only advance lastInboundAt
      update.$max = { lastInboundAt: messageDate };
    } else {
      update.$max = { lastOutboundAt: messageDate };
    }

    await Topic.updateOne({ _id: id }, update);

    // Re-compute unansweredCount from actual thread data
    await this._syncUnansweredCount(id);
  }

  /**
   * Rename a topic (user-initiated). Sets nameEditedByUser=true so Phase 3
   * AI labeling never overwrites it.
   */
  async renameTopic(
    userId: string,
    topicId: string,
    name: string,
  ): Promise<TopicDTO | null> {
    await connectToDatabase();

    const updated = await Topic.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(topicId),
        userId: new mongoose.Types.ObjectId(userId),
      },
      { name: name.trim(), nameEditedByUser: true },
      { new: true },
    );

    return updated ? toTopicDTO(updated) : null;
  }

  /** List all topics for a user, sorted by focusScore desc. */
  async listTopics(userId: string, limit = 50): Promise<TopicDTO[]> {
    await connectToDatabase();

    const topics = await Topic.find({
      userId: new mongoose.Types.ObjectId(userId),
    })
      .sort({ focusScore: -1, lastInboundAt: -1 })
      .limit(limit)
      .lean();

    return topics.map((t) => toTopicDTO(t as unknown as ITopic));
  }

  /** List topics for a specific contact. */
  async listTopicsForContact(
    userId: string,
    contactId: string,
  ): Promise<TopicDTO[]> {
    await connectToDatabase();

    const topics = await Topic.find({
      userId: new mongoose.Types.ObjectId(userId),
      contactId: new mongoose.Types.ObjectId(contactId),
    })
      .sort({ focusScore: -1, lastInboundAt: -1 })
      .lean();

    return topics.map((t) => toTopicDTO(t as unknown as ITopic));
  }

  /** Return a single topic with its threads. */
  async getTopicWithThreads(
    userId: string,
    topicId: string,
  ): Promise<{ topic: TopicDTO; threads: IThread[] } | null> {
    await connectToDatabase();

    const topic = await Topic.findOne({
      _id: new mongoose.Types.ObjectId(topicId),
      userId: new mongoose.Types.ObjectId(userId),
    }).lean();

    if (!topic) return null;

    const threads = await Thread.find({
      _id: { $in: topic.threadIds },
    })
      .sort({ lastMessageDate: -1 })
      .lean();

    return {
      topic: toTopicDTO(topic as unknown as ITopic),
      threads: threads as unknown as IThread[],
    };
  }

  /**
   * Phase 3: AI-label all unlabeled topics for a user.
   *
   * Picks up to `batchSize` topics where `aiLabeled=false` and
   * `nameEditedByUser=false`, calls Gemini for a human-friendly name
   * (2–5 words), then saves `name`, `aiLabeled=true`, `aiLabeledAt`.
   *
   * Safe to call fire-and-forget after clustering.
   */
  async labelUnlabeledTopics(userId: string, batchSize = 20): Promise<void> {
    await connectToDatabase();

    const topics = await Topic.find({
      userId: new mongoose.Types.ObjectId(userId),
      aiLabeled: false,
      nameEditedByUser: false,
    })
      .limit(batchSize)
      .lean();

    if (topics.length === 0) return;

    // Process concurrently but cap at 5 in-flight to respect AI rate limits
    const CONCURRENCY = 5;
    for (let i = 0; i < topics.length; i += CONCURRENCY) {
      const slice = topics.slice(i, i + CONCURRENCY);
      await Promise.all(
        slice.map(async (topic) => {
          try {
            // Gather thread subjects
            const threads = await Thread.find({
              _id: { $in: topic.threadIds },
            })
              .select("subject")
              .lean();

            const threadSubjects = threads
              .map((t: any) => (t.subject as string | undefined)?.trim() ?? "")
              .filter(Boolean);

            // Look up contact name for better label context
            const contact = await Contact.findById(topic.contactId)
              .select("name displayName")
              .lean();
            const contactName: string | undefined =
              (contact as any)?.displayName ||
              (contact as any)?.name ||
              undefined;

            const { name } = await this._aiService.labelTopic(
              topic._id.toString(),
              threadSubjects,
              contactName,
            );

            await Topic.updateOne(
              { _id: topic._id },
              { name, aiLabeled: true, aiLabeledAt: new Date() },
            );
          } catch (err: any) {
            console.warn(
              "[topic.service] labelUnlabeledTopics: failed for",
              topic._id.toString(),
              err.message,
            );
          }
        }),
      );
    }
  }

  // ── Phase 4: Focus score ───────────────────────────────────────────────────

  /**
   * Re-compute and persist `focusScore` + `lastScoredAt` for one topic.
   * Looks up the contact's category to apply the relationship weight.
   *
   * Safe to call fire-and-forget; errors are swallowed.
   */
  async scoreTopicById(
    topicId: mongoose.Types.ObjectId | string,
  ): Promise<void> {
    await connectToDatabase();

    const id =
      topicId instanceof mongoose.Types.ObjectId
        ? topicId
        : new mongoose.Types.ObjectId(topicId as string);

    const topic = await Topic.findById(id).lean();
    if (!topic) return;

    const contact = await Contact.findById(topic.contactId)
      .select("category")
      .lean();

    const score = computeFocusScore({
      unansweredCount: topic.unansweredCount,
      lastInboundAt: topic.lastInboundAt,
      contactCategory: (contact as any)?.category,
      chatInsights: topic.chatInsights
    });

    await Topic.updateOne(
      { _id: id },
      { focusScore: score, lastScoredAt: new Date() },
    );
  }

  /**
   * Re-score every topic for a given user.
   * Called once at the end of each sync pipeline (cluster → label → score).
   * Batches with a short pause to avoid hammering MongoDB.
   */
  async scoreAllTopicsForUser(userId: string): Promise<void> {
    await connectToDatabase();

    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Fetch all topics + their contact category in one query via $lookup
    const rows: Array<{
      _id: mongoose.Types.ObjectId;
      unansweredCount: number;
      lastInboundAt?: Date;
      contactCategory?: string;
    }> = await Topic.aggregate([
      { $match: { userId: userObjectId } },
      {
        $lookup: {
          from: "contacts",
          localField: "contactId",
          foreignField: "_id",
          as: "_contact",
        },
      },
      {
        $project: {
          unansweredCount: 1,
          lastInboundAt: 1,
          chatInsights: 1,
          contactCategory: { $arrayElemAt: ["$_contact.category", 0] },
        },
      },
    ]);

    if (rows.length === 0) return;

    const BATCH = 50;
    for (let i = 0; i < rows.length; i += BATCH) {
      const slice = rows.slice(i, i + BATCH);
      await Promise.all(
        slice.map((row) =>
          Topic.updateOne(
            { _id: row._id },
            {
              focusScore: computeFocusScore({
                unansweredCount: row.unansweredCount,
                lastInboundAt: row.lastInboundAt,
                contactCategory: row.contactCategory,
                chatInsights: (row as any).chatInsights,
              }),
              lastScoredAt: new Date(),
            },
          ),
        ),
      );
    }
  }

  /**
   * Return the top-N topics for the Focus page, sorted by focusScore desc.
   * Populates the primary contact for each topic.
   */
  async getFocusTopics(userId: string, limit = 20): Promise<FocusTopicDTO[]> {
    await connectToDatabase();

    const userObjectId = new mongoose.Types.ObjectId(userId);

    const rows = await Topic.aggregate([
      { $match: { userId: userObjectId, focusScore: { $gt: 0 } } },
      { $sort: { focusScore: -1, lastInboundAt: -1 } },
      // Fetch more than needed to account for post-join spam/noreply filtering
      { $limit: limit * 3 },
      {
        $lookup: {
          from: "contacts",
          localField: "contactId",
          foreignField: "_id",
          as: "_contact",
        },
      },
      {
        $addFields: {
          _contactDoc: { $arrayElemAt: ["$_contact", 0] },
        },
      },
      // Exclude spam contacts and noreply senders
      {
        $match: {
          "_contactDoc.category": { $ne: "spam" },
          "_contactDoc.email": {
            $not: {
              $regex:
                "^(noreply|no-reply|donotreply|do-not-reply|notifications?|newsletter|bounce|postmaster|mailer-daemon|auto-?reply)@",
              $options: "i",
            },
          },
        },
      },
      { $limit: limit },
    ]);

    return rows.map((row: any) => ({
      _id: row._id.toString(),
      contactId: row.contactId.toString(),
      name: row.name,
      nameEditedByUser: row.nameEditedByUser,
      threadCount: row.threadCount,
      unansweredCount: row.unansweredCount,
      focusScore: row.focusScore,
      lastInboundAt: row.lastInboundAt?.toISOString(),
      lastOutboundAt: row.lastOutboundAt?.toISOString(),
      aiLabeled: row.aiLabeled,
      chatInsights: row.chatInsights?.map((insight: any) => ({
        _id: insight._id?.toString() ?? "",
        intent: insight.intent,
        summary: insight.summary,
        sourceChatId: insight.sourceChatId,
        date: insight.date?.toISOString() ?? "",
      })),
      createdAt: row.createdAt?.toISOString(),
      updatedAt: row.updatedAt?.toISOString(),
      contact: {
        _id: row._contactDoc?._id?.toString() ?? row.contactId.toString(),
        email: row._contactDoc?.email ?? "",
        name: row._contactDoc?.name,
        org: row._contactDoc?.org,
        category: row._contactDoc?.category ?? "unknown",
        categories: row._contactDoc?.categories ?? [],
      },
    }));
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private _aiService = new AIService();

  /** Find the primary contact email: first participant that is not the user. */
  private _primaryContactEmail(
    participants: string[],
    userEmail: string | undefined,
  ): string | undefined {
    for (const raw of participants) {
      const email = parseEmail(raw);
      if (!userEmail || email !== userEmail) return email;
    }
    return undefined;
  }

  /**
   * Assign one thread to an existing or new topic.
   * Mutates `topicsByContact` in place to include newly-created topics.
   */
  private async _assignThread(
    thread: IThread,
    userObjectId: mongoose.Types.ObjectId,
    userEmail: string | undefined,
    contactsRaw: Record<string, any>,
    topicsByContact: Map<string, ITopic[]>,
  ): Promise<void> {
    const contactEmail = this._primaryContactEmail(
      thread.participants ?? [],
      userEmail,
    );
    if (!contactEmail) return;

    const contact = contactsRaw[contactEmail];
    if (!contact) return; // contact not created yet; will be handled next sync

    const contactIdStr = contact._id.toString();
    const normalizedSubject = normalizeSubject(thread.subject ?? "");

    // Try to find a matching active topic for this contact
    const candidateTopics = topicsByContact.get(contactIdStr) ?? [];
    const matchedTopic = candidateTopics.find((tp) =>
      subjectMatchesTopic(normalizedSubject, tp.name),
    );

    if (matchedTopic) {
      await this._addThreadToTopic(thread, matchedTopic._id);
    } else {
      // Create a new Topic with the normalized subject as a temporary name
      const newTopic = await Topic.create({
        userId: userObjectId,
        contactId: contact._id,
        name: normalizedSubject || thread.subject || "Untitled",
        nameEditedByUser: false,
        threadIds: [thread._id],
        threadCount: 1,
        noiseCount: thread.noiseFiltered ? 1 : 0,
        lastInboundAt:
          thread.lastMessageDirection === "inbound"
            ? (thread.lastInboundAt ?? thread.lastMessageDate)
            : undefined,
        lastOutboundAt:
          thread.lastMessageDirection === "outbound"
            ? thread.lastMessageDate
            : undefined,
        unansweredCount: thread.lastMessageDirection === "inbound" ? 1 : 0,
        focusScore: 0,
        aiLabeled: false,
      });

      // Update Thread.topicId
      await Thread.updateOne({ _id: thread._id }, { topicId: newTopic._id });

      // Add to in-memory map so subsequent threads in this batch can match it
      const topicList = topicsByContact.get(contactIdStr) ?? [];
      topicList.push(newTopic as unknown as ITopic);
      topicsByContact.set(contactIdStr, topicList);
    }
  }

  /** Add an existing thread to an existing topic. */
  private async _addThreadToTopic(
    thread: IThread,
    topicId: mongoose.Types.ObjectId,
  ): Promise<void> {
    const threadId = (thread as any)._id;

    await Promise.all([
      // Add thread ref to topic, update denormalized counters
      Topic.updateOne(
        { _id: topicId },
        {
          $addToSet: { threadIds: threadId },
          $inc: {
            threadCount: 1,
            ...(thread.noiseFiltered ? { noiseCount: 1 } : {}),
          },
          ...(thread.lastMessageDirection === "inbound" && thread.lastInboundAt
            ? { $max: { lastInboundAt: thread.lastInboundAt } }
            : {}),
          ...(thread.lastMessageDirection === "outbound" &&
          thread.lastMessageDate
            ? { $max: { lastOutboundAt: thread.lastMessageDate } }
            : {}),
        },
      ),
      // Set Thread.topicId
      Thread.updateOne({ _id: threadId }, { topicId }),
    ]);

    // Recompute unansweredCount after adding the thread
    await this._syncUnansweredCount(topicId);
  }

  /**
   * Re-compute `unansweredCount` from actual Thread documents.
   * "Unanswered" = thread in topic where lastMessageDirection = "inbound".
   */
  private async _syncUnansweredCount(
    topicId: mongoose.Types.ObjectId,
  ): Promise<void> {
    const topic = await Topic.findById(topicId).lean();
    if (!topic) return;

    const unansweredCount = await Thread.countDocuments({
      _id: { $in: topic.threadIds },
      lastMessageDirection: "inbound",
      isArchived: { $ne: true },
    });

    await Topic.updateOne({ _id: topicId }, { unansweredCount });
  }
}
