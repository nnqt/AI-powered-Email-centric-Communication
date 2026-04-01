import mongoose from "mongoose";

import { connectToDatabase } from "@/lib/db";
import { Thread, IThread } from "@/models/Thread";
import { Topic, ITopic } from "@/models/Topic";
import { Contact, IContact } from "@/models/Contact";
import { TelegramMessage } from "@/models/TelegramMessage";
import { User } from "@/models/User";
import { AIService } from "@/modules/ai/ai.service";

// ── Subject helpers ──────────────────────────────────────────────────────────

// Prefixes to strip before comparing subjects (case-insensitive).
const _SUBJECT_PREFIX_RE = /^(re|fwd?|fw|tr|r|sv|antw|aw|rép|enc):\s*/i;
const _TOKEN_SPLIT_RE = /[^a-z0-9]+/i;
const _REFERENCE_CODE_RE = /\b([a-z]{1,6}-\d{1,8})\b/gi;

const _STOP_WORDS = new Set([
  "va",
  "voi",
  "cho",
  "cua",
  "tren",
  "duoi",
  "trong",
  "ngoai",
  "nhung",
  "nhung",
  "the",
  "la",
  "mot",
  "cac",
  "anh",
  "chi",
  "team",
  "gui",
  "cap",
  "nhat",
  "thong",
  "nhat",
  "ke",
  "hoach",
  "dot",
  "sau",
  "truoc",
  "today",
  "tomorrow",
  "re",
  "fwd",
  "fw",
]);

function _stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function _normalizeForKey(value: string): string {
  return _stripDiacritics(value.toLowerCase())
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function _extractKeyTokens(value: string): string[] {
  return _normalizeForKey(value)
    .split(_TOKEN_SPLIT_RE)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !_STOP_WORDS.has(t));
}

function _extractReferenceCodes(value: string): string[] {
  const normalized = _stripDiacritics(value.toLowerCase());
  const matches = normalized.match(_REFERENCE_CODE_RE) ?? [];
  return Array.from(new Set(matches.map((code) => code.trim()))).slice(0, 5);
}

function _deriveClusterKey(thread: IThread): string | undefined {
  const normalizedSubject = normalizeSubject(thread.subject ?? "");
  const summaryText = Array.isArray(thread.summary?.text)
    ? thread.summary?.text.join(" ")
    : (thread.summary?.text ?? "");
  const sourceText = [normalizedSubject, thread.snippet ?? "", summaryText]
    .filter(Boolean)
    .join(" ");

  const tokens = _extractKeyTokens(sourceText);
  if (tokens.length === 0) return undefined;

  const tokenSet = new Set(tokens);
  const dimensions: string[] = [];

  if (tokenSet.has("crm")) dimensions.push("crm");
  if (tokenSet.has("erp")) dimensions.push("erp");
  if (tokenSet.has("uat") || tokenSet.has("release") || tokenSet.has("backlog")) {
    dimensions.push("delivery");
  }
  if (
    tokenSet.has("pham") ||
    tokenSet.has("scope") ||
    tokenSet.has("module") ||
    tokenSet.has("ban") ||
    tokenSet.has("giao")
  ) {
    dimensions.push("scope");
  }

  if (dimensions.length > 0) {
    return `h:${dimensions.join("-")}`;
  }

  const top = Array.from(new Set(tokens)).sort().slice(0, 3);
  return top.length > 0 ? `h:${top.join("-")}` : undefined;
}

function _collectBusinessMarkers(threadOrTopic: {
  subject?: string;
  snippet?: string;
  summaryText?: string;
  threadSubjects?: string[];
  threadCategories?: string[];
  clusterKey?: string;
}): string[] {
  const pool = [
    threadOrTopic.subject ?? "",
    threadOrTopic.snippet ?? "",
    threadOrTopic.summaryText ?? "",
    ...(threadOrTopic.threadSubjects ?? []),
    ...(threadOrTopic.threadCategories ?? []),
    threadOrTopic.clusterKey ?? "",
  ]
    .join(" ")
    .trim();

  if (!pool) return [];

  const refs = _extractReferenceCodes(pool).map((code) => `ref:${code}`);
  const keyTokens = _extractKeyTokens(pool)
    .slice(0, 12)
    .map((token) => `kw:${token}`);

  return Array.from(new Set([...refs, ...keyTokens])).slice(0, 20);
}

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

export interface FocusOverviewDTO {
  totalFocusTopics: number;
  highPriorityCount: number;
  topFocusScore: number;
  lastScoredAt?: string;
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
  ): Promise<string[]> {
    if (threadDocIds.length === 0) return [];
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

    if (threads.length === 0) return [];

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
    const touchedContactIds = new Set<string>();
    for (const thread of threads) {
      try {
        const contactEmail = this._primaryContactEmail(
          thread.participants ?? [],
          userEmail,
        );
        const contact = contactEmail ? contactsRaw[contactEmail] : undefined;
        if (contact?._id) {
          touchedContactIds.add(contact._id.toString());
        }

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

    if (touchedContactIds.size > 0) {
      await this.mergeLikelyTopicsForUser(userId, Array.from(touchedContactIds));
    }

    return Array.from(touchedContactIds);
  }

  async mergeLikelyTopicsForUser(
    userId: string,
    contactIds?: string[],
  ): Promise<void> {
    await connectToDatabase();

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const match: Record<string, any> = { userId: userObjectId };

    if (contactIds && contactIds.length > 0) {
      match.contactId = {
        $in: contactIds.map((id) => new mongoose.Types.ObjectId(id)),
      };
    }

    const rows = await Topic.aggregate([
      { $match: match },
      { $group: { _id: "$contactId", count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
    ]);

    for (const row of rows) {
      await this._mergeLikelyTopicsForContact(userObjectId, row._id);
    }
  }

  async aiConsolidateTopicsForContacts(
    userId: string,
    contactIds?: string[],
    minConfidence = 0.8,
  ): Promise<void> {
    await connectToDatabase();

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const match: Record<string, any> = { userId: userObjectId };

    if (contactIds && contactIds.length > 0) {
      match._id = { $in: contactIds.map((id) => new mongoose.Types.ObjectId(id)) };
    }

    const contacts = await Contact.find(match)
      .select("_id name email telegramId")
      .lean<any[]>();

    for (const contact of contacts) {
      const topics = await Topic.find({
        userId: userObjectId,
        contactId: contact._id,
      })
        .sort({ createdAt: 1 })
        .lean<any[]>();

      if (topics.length < 1) continue;

      const allThreadIds = topics.flatMap((t) => (t.threadIds ?? []).map((id: any) => new mongoose.Types.ObjectId(id)));
      const threads = await Thread.find({ _id: { $in: allThreadIds } })
        .select("_id subject snippet summary categories")
        .lean<any[]>();
      const threadMap = new Map(threads.map((t: any) => [t._id.toString(), t]));

      const recentTelegramMessages = contact.telegramId
        ? await TelegramMessage.find({
            userId: userObjectId,
            $or: [{ senderId: contact.telegramId }, { chatId: contact.telegramId }],
          })
            .sort({ date: -1 })
            .limit(20)
            .select("text")
            .lean<any[]>()
        : [];

      const telegramMessageTexts = recentTelegramMessages
        .map((m: any) => this._truncateTopicContext((m.text || "").trim(), 220))
        .filter(Boolean)
        .slice(0, 10);

      const candidates = topics.map((topic) => {
        const topicThreads = (topic.threadIds ?? [])
          .map((id: any) => threadMap.get(id.toString()))
          .filter(Boolean);

        const threadSummaries = topicThreads
          .map((t: any) => {
            const text = t?.summary?.text;
            if (Array.isArray(text)) return text.join(" ");
            return typeof text === "string" ? text : "";
          })
          .map((text: string) => this._truncateTopicContext(text, 900))
          .filter(Boolean);

        const threadKeyIssues = topicThreads
          .flatMap((t: any) => (Array.isArray(t?.summary?.key_issues) ? t.summary.key_issues : []))
          .map((text: string) => this._truncateTopicContext(text, 220))
          .filter(Boolean)
          .slice(0, 20);

        const threadActionRequired = topicThreads
          .flatMap((t: any) => (Array.isArray(t?.summary?.action_required) ? t.summary.action_required : []))
          .map((text: string) => this._truncateTopicContext(text, 220))
          .filter(Boolean)
          .slice(0, 20);

        const threadCategories: string[] = Array.from(
          new Set<string>(
            topicThreads.flatMap((t: any) =>
              Array.isArray(t?.categories)
                ? (t.categories as unknown[])
                    .filter((c): c is string => typeof c === "string")
                : [],
            ),
          ),
        ).slice(0, 20);

        const telegramInsights = (topic.chatInsights ?? [])
          .map((ins: any) => this._truncateTopicContext(`${ins.intent}: ${ins.summary}`, 260))
          .filter(Boolean)
          .slice(0, 12);

        const businessMarkers = _collectBusinessMarkers({
          subject: topic.name,
          snippet: topicThreads.map((t: any) => t?.snippet || "").join(" "),
          summaryText: threadSummaries.join(" "),
          threadSubjects: topicThreads
            .map((t: any) => (t?.subject || "").trim())
            .filter(Boolean),
          threadCategories,
          clusterKey: topic.clusterKey,
        });

        return {
          topic_id: topic._id.toString(),
          name: topic.name,
          cluster_key: topic.clusterKey,
          name_edited_by_user: !!topic.nameEditedByUser,
          thread_subjects: topicThreads
            .map((t: any) => this._truncateTopicContext((t?.subject || "").trim(), 140))
            .filter(Boolean)
            .slice(0, 25),
          thread_summaries: threadSummaries,
          thread_key_issues: threadKeyIssues,
          thread_action_required: threadActionRequired,
          thread_categories: threadCategories,
          business_markers: businessMarkers,
          last_inbound_at: topic.lastInboundAt?.toISOString?.() || topic.lastInboundAt,
          last_outbound_at: topic.lastOutboundAt?.toISOString?.() || topic.lastOutboundAt,
          telegram_chat_insights: telegramInsights,
          telegram_recent_messages: telegramMessageTexts,
        };
      });

      const aiResult = await this._aiService.consolidateTopics(
        contact._id.toString(),
        contact.name || contact.email,
        candidates,
        minConfidence,
      );

      for (const cluster of aiResult.clusters) {
        if (!Array.isArray(cluster.topic_ids) || cluster.topic_ids.length < 2) continue;
        await this._applyAiClusterDecision(cluster);
      }

      if (Array.isArray(aiResult.topicNameOverrides) && aiResult.topicNameOverrides.length > 0) {
        await this._applyAiTopicNameOverrides(aiResult.topicNameOverrides);
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

  async getFocusOverview(userId: string): Promise<FocusOverviewDTO> {
    await connectToDatabase();

    const userObjectId = new mongoose.Types.ObjectId(userId);

    const rows = await Topic.aggregate([
      { $match: { userId: userObjectId, focusScore: { $gt: 0 } } },
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
      {
        $group: {
          _id: null,
          totalFocusTopics: { $sum: 1 },
          highPriorityCount: {
            $sum: {
              $cond: [{ $gte: ["$focusScore", 60] }, 1, 0],
            },
          },
          topFocusScore: { $max: "$focusScore" },
          lastScoredAt: { $max: "$lastScoredAt" },
        },
      },
    ]);

    const row = rows[0];
    return {
      totalFocusTopics: row?.totalFocusTopics ?? 0,
      highPriorityCount: row?.highPriorityCount ?? 0,
      topFocusScore: row?.topFocusScore ?? 0,
      lastScoredAt: row?.lastScoredAt?.toISOString?.(),
    };
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
    const threadClusterKey = thread.topicKey || _deriveClusterKey(thread);

    if (threadClusterKey && thread.topicKey !== threadClusterKey) {
      await Thread.updateOne(
        { _id: (thread as any)._id },
        {
          topicKey: threadClusterKey,
          topicKeySource: thread.topicKey ? "ai" : "heuristic",
          topicKeyConfidence:
            typeof (thread as any).topicKeyConfidence === "number"
              ? (thread as any).topicKeyConfidence
              : 0.65,
        },
      );
    }

    // Try to find a matching active topic for this contact
    const candidateTopics = topicsByContact.get(contactIdStr) ?? [];
    let matchedTopic =
      threadClusterKey
        ? candidateTopics.find((tp: any) => tp.clusterKey === threadClusterKey)
        : undefined;

    if (!matchedTopic) {
      matchedTopic = candidateTopics.find((tp) =>
        subjectMatchesTopic(normalizedSubject, tp.name),
      );
    }

    if (matchedTopic) {
      if (threadClusterKey && !(matchedTopic as any).clusterKey) {
        await Topic.updateOne(
          { _id: matchedTopic._id },
          {
            clusterKey: threadClusterKey,
            clusterKeySource: thread.topicKey ? "ai" : "heuristic",
            clusterVersion: 1,
          },
        );
      }
      await this._addThreadToTopic(thread, matchedTopic._id);
    } else {
      // Create a new Topic with the normalized subject as a temporary name
      const newTopic = await Topic.create({
        userId: userObjectId,
        contactId: contact._id,
        isMock: !!thread.isMock,
        name: normalizedSubject || thread.subject || "Untitled",
        clusterKey: threadClusterKey,
        clusterKeySource:
          threadClusterKey && thread.topicKey ? "ai" : threadClusterKey ? "heuristic" : undefined,
        clusterVersion: threadClusterKey ? 1 : undefined,
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

  private _tokenOverlapRatio(a: string, b: string): number {
    const aSet = new Set(_extractKeyTokens(a));
    const bSet = new Set(_extractKeyTokens(b));
    if (aSet.size === 0 || bSet.size === 0) return 0;

    let overlap = 0;
    for (const token of aSet) {
      if (bSet.has(token)) overlap += 1;
    }

    return overlap / Math.max(aSet.size, bSet.size);
  }

  private _truncateTopicContext(text: string, limit: number): string {
    if (!text) return "";
    if (text.length <= limit) return text;
    return `${text.slice(0, limit)}...`;
  }

  private async _applyAiClusterDecision(cluster: {
    canonical_cluster_key: string;
    canonical_name: string;
    topic_ids: string[];
    confidence: number;
    reason: string;
  }): Promise<void> {
    const topicIds = cluster.topic_ids
      .map((id) => id.trim())
      .filter(Boolean)
      .map((id) => new mongoose.Types.ObjectId(id));

    const topics = await Topic.find({ _id: { $in: topicIds } }).lean<any[]>();
    if (topics.length < 2) return;

    let target = topics[0];
    for (let i = 1; i < topics.length; i += 1) {
      target = this._pickMergeTarget(target, topics[i]);
    }

    target.clusterKey = cluster.canonical_cluster_key;
    target.clusterKeySource = "ai";
    target.clusterVersion = Math.max(1, (target.clusterVersion ?? 1) + 1);

    await Topic.updateOne(
      { _id: target._id },
      {
        clusterKey: target.clusterKey,
        clusterKeySource: "ai",
        clusterVersion: target.clusterVersion,
        ...(target.nameEditedByUser
          ? {}
          : { name: this._truncateTopicContext(cluster.canonical_name || target.name, 100) }),
      },
    );

    for (const topic of topics) {
      if (topic._id.toString() === target._id.toString()) continue;
      await this._mergeTopicPair(target, topic);
    }
  }

  private async _applyAiTopicNameOverrides(
    overrides: Array<{ topic_id: string; name: string; confidence: number }>,
  ): Promise<void> {
    for (const row of overrides) {
      const topicId = row.topic_id?.trim();
      const name = row.name?.trim();
      if (!topicId || !name) continue;

      try {
        const existing = await Topic.findById(topicId)
          .select("nameEditedByUser")
          .lean<any>();
        if (!existing || existing.nameEditedByUser) continue;

        await Topic.updateOne(
          { _id: new mongoose.Types.ObjectId(topicId) },
          {
            name: this._truncateTopicContext(name, 100),
            aiLabeled: true,
            aiLabeledAt: new Date(),
          },
        );
      } catch {
        continue;
      }
    }
  }

  private _shouldMergeTopics(a: any, b: any): boolean {
    if (a.nameEditedByUser || b.nameEditedByUser) return false;

    if (a.clusterKey && b.clusterKey && a.clusterKey === b.clusterKey) {
      return true;
    }

    const nameA = normalizeSubject(a.name ?? "");
    const nameB = normalizeSubject(b.name ?? "");

    if (subjectMatchesTopic(nameA, nameB)) {
      return true;
    }

    const overlap = this._tokenOverlapRatio(
      `${nameA} ${a.clusterKey ?? ""}`,
      `${nameB} ${b.clusterKey ?? ""}`,
    );

    const latestA = a.lastInboundAt || a.lastOutboundAt || a.updatedAt || a.createdAt;
    const latestB = b.lastInboundAt || b.lastOutboundAt || b.updatedAt || b.createdAt;
    const ageGapDays = Math.abs(
      (new Date(latestA).getTime() - new Date(latestB).getTime()) /
        (24 * 60 * 60 * 1000),
    );

    return overlap >= 0.72 && ageGapDays <= 45;
  }

  private _pickMergeTarget(a: any, b: any): any {
    if (a.nameEditedByUser && !b.nameEditedByUser) return a;
    if (b.nameEditedByUser && !a.nameEditedByUser) return b;
    if ((a.threadCount ?? 0) !== (b.threadCount ?? 0)) {
      return (a.threadCount ?? 0) >= (b.threadCount ?? 0) ? a : b;
    }
    return new Date(a.createdAt).getTime() <= new Date(b.createdAt).getTime()
      ? a
      : b;
  }

  private async _mergeTopicPair(target: any, source: any): Promise<void> {
    const targetId = target._id as mongoose.Types.ObjectId;
    const sourceId = source._id as mongoose.Types.ObjectId;

    if (targetId.toString() === sourceId.toString()) return;

    const sourceThreadIds = (source.threadIds ?? []).map((id: any) =>
      new mongoose.Types.ObjectId(id),
    );

    const threadUpdate: Record<string, any> = { topicId: targetId };
    if (target.clusterKey) {
      threadUpdate.topicKey = target.clusterKey;
      threadUpdate.topicKeySource = target.clusterKeySource ?? "heuristic";
    }

    await Thread.updateMany({ _id: { $in: sourceThreadIds } }, threadUpdate);

    const mergedChatInsights = [
      ...(target.chatInsights ?? []),
      ...(source.chatInsights ?? []),
    ];

    const allThreads = await Thread.find({ topicId: targetId })
      .select(
        "_id noiseFiltered lastMessageDirection lastInboundAt lastMessageDate isMock",
      )
      .lean<any[]>();

    const unansweredCount = allThreads.filter(
      (t) => t.lastMessageDirection === "inbound",
    ).length;
    const noiseCount = allThreads.filter((t) => t.noiseFiltered).length;

    const inboundDates = allThreads
      .map((t) => t.lastInboundAt || (t.lastMessageDirection === "inbound" ? t.lastMessageDate : undefined))
      .filter((d): d is Date => d instanceof Date);

    const outboundDates = allThreads
      .map((t) => (t.lastMessageDirection === "outbound" ? t.lastMessageDate : undefined))
      .filter((d): d is Date => d instanceof Date);

    await Topic.updateOne(
      { _id: targetId },
      {
        threadIds: allThreads.map((t) => t._id),
        threadCount: allThreads.length,
        noiseCount,
        unansweredCount,
        isMock: !!target.isMock || !!source.isMock,
        ...(inboundDates.length > 0
          ? {
              lastInboundAt: new Date(
                Math.max(...inboundDates.map((d) => d.getTime())),
              ),
            }
          : {}),
        ...(outboundDates.length > 0
          ? {
              lastOutboundAt: new Date(
                Math.max(...outboundDates.map((d) => d.getTime())),
              ),
            }
          : {}),
        chatInsights: mergedChatInsights,
      },
    );

    await Topic.deleteOne({ _id: sourceId });
  }

  private async _mergeLikelyTopicsForContact(
    userObjectId: mongoose.Types.ObjectId,
    contactId: mongoose.Types.ObjectId,
  ): Promise<void> {
    let safetyCounter = 0;

    while (safetyCounter < 30) {
      safetyCounter += 1;

      const topics = await Topic.find({ userId: userObjectId, contactId })
        .sort({ createdAt: 1 })
        .lean<any[]>();

      if (topics.length < 2) return;

      let merged = false;

      for (let i = 0; i < topics.length; i += 1) {
        for (let j = i + 1; j < topics.length; j += 1) {
          const a = topics[i];
          const b = topics[j];

          if (!this._shouldMergeTopics(a, b)) continue;

          const target = this._pickMergeTarget(a, b);
          const source =
            target._id.toString() === a._id.toString() ? b : a;

          await this._mergeTopicPair(target, source);
          merged = true;
          break;
        }
        if (merged) break;
      }

      if (!merged) return;
    }
  }
}
