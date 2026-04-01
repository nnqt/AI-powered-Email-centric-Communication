import axios from "axios";
import { IThreadSummary } from "@/models/Thread";
import { incrementMetric, observeMetricMs } from "@/lib/runtimeMetrics";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:5000";

interface SummarizeMessage {
  id: string;
  from: string;
  to: string[];
  sent_at: string;
  text: string;
}

interface SummarizeRequest {
  thread_id: string;
  messages: SummarizeMessage[];
}

interface SummarizeResponse {
  thread_id: string;
  summary: string | string[];
  key_issues: string[];
  action_required: string[];
}

interface AnalyzeThreadMessage {
  id: string;
  from: string;
  to: string[];
  sent_at: string;
  text: string;
}

interface AnalyzeThreadRequest {
  thread_id: string;
  subject?: string;
  snippet?: string;
  sender_email?: string;
  sender_categories?: string[];
  messages: AnalyzeThreadMessage[];
}

interface AnalyzeThreadResponse {
  thread_id: string;
  categories: string[];
  noise_filtered: boolean;
  topic_key?: string | null;
  topic_key_confidence?: number | null;
  summary?: string | string[] | null;
  key_issues?: string[];
  action_required?: string[];
  quality_tier?: "noise" | "low" | "normal" | "high";
  should_cluster?: boolean;
  should_summarize?: boolean;
}

interface SuggestReplyRequest {
  thread_id: string;
  conversation_context?: string;
  latest_message: {
    id: string;
    from_: string;
    text: string;
  };
  max_replies: number;
  format?: "email" | "message";
  thread_intent?: string;
  sender_category?: string;
  selected_next_actions?: string[];
  additional_context?: string;
}

interface ReplyItem {
  subject: string | null;
  body: string;
}

interface SuggestReplyResponse {
  thread_id: string;
  format: string;
  replies: ReplyItem[];
}

interface EnrichContactRequest {
  email: string;
  name?: string;
  conversation_snippet?: string;
  user_email_domain?: string;
}

interface EnrichContactResponse {
  email: string;
  display_name: string | null;
  org: string | null;
  language: string | null;
  category_suggestion: string | null;
}

interface ContactSnippet {
  contact_id: string;
  email: string;
  name?: string;
  alternate_emails?: string[];
  sample_threads?: string[];
}

interface MergeSuggestion {
  source_id: string;
  target_id: string;
  source_email: string;
  target_email: string;
  confidence: number;
  reason: string;
}

interface SuggestMergeResponse {
  suggestions: MergeSuggestion[];
}

interface TopicConsolidationCandidate {
  topic_id: string;
  name?: string;
  cluster_key?: string;
  name_edited_by_user?: boolean;
  thread_subjects: string[];
  thread_summaries: string[];
  thread_key_issues: string[];
  thread_action_required: string[];
  thread_categories: string[];
  business_markers: string[];
  last_inbound_at?: string;
  last_outbound_at?: string;
  telegram_chat_insights: string[];
  telegram_recent_messages: string[];
}

interface TopicConsolidationCluster {
  canonical_cluster_key: string;
  canonical_name: string;
  topic_ids: string[];
  confidence: number;
  reason: string;
}

interface TopicNameOverride {
  topic_id: string;
  name: string;
  confidence: number;
}

export type { EnrichContactResponse, MergeSuggestion, ReplyItem };

export class AIService {
  async analyzeThread(payload: AnalyzeThreadRequest): Promise<{
    categories: string[];
    noiseFiltered: boolean;
    topicKey?: string;
    topicKeyConfidence?: number;
    summary?: IThreadSummary;
    qualityTier?: "noise" | "low" | "normal" | "high";
    shouldCluster?: boolean;
    shouldSummarize?: boolean;
  }> {
    const startedAt = Date.now();
    try {
      const response = await axios.post<AnalyzeThreadResponse>(
        `${AI_SERVICE_URL}/analyze-thread`,
        payload,
        { timeout: 45_000 },
      );

      console.info(
        JSON.stringify({
          metric: "ai.analyze_thread",
          thread_id: payload.thread_id,
          latency_ms: Date.now() - startedAt,
          noise_filtered: !!response.data.noise_filtered,
          quality_tier: response.data.quality_tier ?? "normal",
        }),
      );
      incrementMetric("ai.analyze_thread.success");
      if (response.data.noise_filtered) {
        incrementMetric("ai.analyze_thread.noise");
      }
      observeMetricMs("ai.analyze_thread.latency", Date.now() - startedAt);

      const hasSummary =
        response.data.summary !== null && response.data.summary !== undefined;

      return {
        categories: response.data.categories ?? [],
        noiseFiltered: !!response.data.noise_filtered,
        topicKey: response.data.topic_key ?? undefined,
        topicKeyConfidence: response.data.topic_key_confidence ?? undefined,
        summary: hasSummary
          ? {
              text: response.data.summary as string | string[],
              key_issues: response.data.key_issues ?? [],
              action_required: response.data.action_required ?? [],
            }
          : undefined,
        qualityTier: response.data.quality_tier,
        shouldCluster: response.data.should_cluster,
        shouldSummarize: response.data.should_summarize,
      };
    } catch (error: any) {
      incrementMetric("ai.analyze_thread.error");
      observeMetricMs("ai.analyze_thread.latency", Date.now() - startedAt);
      console.error(
        "AI analyze-thread failed:",
        error.response?.data || error.message,
      );
      throw new Error(
        `AI analyze-thread failed: ${
          error.response?.data?.detail || error.message
        }`,
      );
    }
  }

  async summarizeThread(
    threadId: string,
    messages: Array<{
      id: string;
      from?: string;
      to: string[];
      date?: Date;
      body?: string;
    }>,
  ): Promise<IThreadSummary> {
    const payload: SummarizeRequest = {
      thread_id: threadId,
      messages: messages.map((m) => ({
        id: m.id,
        from: m.from || "",
        to: m.to,
        sent_at: m.date?.toISOString() || new Date().toISOString(),
        text: m.body || "",
      })),
    };

    try {
      const response = await axios.post<SummarizeResponse>(
        `${AI_SERVICE_URL}/summarize`,
        payload,
        { timeout: 30000 },
      );

      return {
        text: response.data.summary,
        key_issues: response.data.key_issues,
        action_required: response.data.action_required,
      };
    } catch (error: any) {
      console.error("AI summarization failed:", error.message);
      throw new Error(
        `AI summarization failed: ${
          error.response?.data?.detail || error.message
        }`,
      );
    }
  }

  async suggestReplies(
    threadId: string,
    latestMessage: { id: string; from?: string; text: string },
    context?: string,
    maxReplies = 3,
    format: "email" | "message" = "message",
    threadIntent?: string,
    senderCategory?: string,
    selectedNextActions?: string[],
    additionalContext?: string,
  ): Promise<{ format: string; replies: ReplyItem[] }> {
    const payload: SuggestReplyRequest = {
      thread_id: threadId,
      conversation_context: context,
      latest_message: {
        id: latestMessage.id,
        from_: latestMessage.from || "",
        text: latestMessage.text,
      },
      max_replies: maxReplies,
      format,
      thread_intent: threadIntent,
      sender_category: senderCategory,
      selected_next_actions: selectedNextActions,
      additional_context: additionalContext,
    };

    try {
      const response = await axios.post<SuggestReplyResponse>(
        `${AI_SERVICE_URL}/suggest-reply`,
        payload,
        { timeout: 30000 },
      );
      return {
        format: response.data.format,
        replies: response.data.replies,
      };
    } catch (error: any) {
      console.error("AI suggest-reply failed:", error.message);
      throw new Error(
        `AI suggest-reply failed: ${
          error.response?.data?.detail || error.message
        }`,
      );
    }
  }

  async enrichContact(
    email: string,
    name?: string,
    conversationSnippet?: string,
    userEmailDomain?: string,
  ): Promise<EnrichContactResponse> {
    const payload: EnrichContactRequest = {
      email,
      name,
      conversation_snippet: conversationSnippet,
      user_email_domain: userEmailDomain,
    };

    try {
      const response = await axios.post<EnrichContactResponse>(
        `${AI_SERVICE_URL}/enrich-contact`,
        payload,
        { timeout: 30000 },
      );
      return response.data;
    } catch (error: any) {
      console.error("AI enrich-contact failed:", error.message);
      throw new Error(
        `AI enrich-contact failed: ${
          error.response?.data?.detail || error.message
        }`,
      );
    }
  }

  async classifyUrgent(
    threadId: string,
    subject?: string,
    snippet?: string,
    senderEmail?: string,
    senderCategories?: string[],
  ): Promise<{ isUrgent: boolean; reason: string }> {
    try {
      const response = await axios.post<{
        thread_id: string;
        is_urgent: boolean;
        reason: string;
      }>(
        `${AI_SERVICE_URL}/classify-urgent`,
        {
          thread_id: threadId,
          subject,
          snippet,
          sender_email: senderEmail,
          sender_categories: senderCategories,
        },
        { timeout: 15000 },
      );
      return {
        isUrgent: response.data.is_urgent,
        reason: response.data.reason,
      };
    } catch (error: any) {
      console.error("AI classify-urgent failed:", error.message);
      // Non-fatal: return false rather than throwing
      return { isUrgent: false, reason: "Classification unavailable" };
    }
  }

  async classifyThreadCategory(
    threadId: string,
    subject?: string,
    snippet?: string,
    senderEmail?: string,
    senderCategories?: string[],
  ): Promise<{
    categories: string[];
    noiseFiltered: boolean;
    topicKey?: string;
    topicKeyConfidence?: number;
  }> {
    try {
      const response = await axios.post<{
        thread_id: string;
        categories: string[];
        noise_filtered: boolean;
        topic_key?: string | null;
        topic_key_confidence?: number | null;
      }>(
        `${AI_SERVICE_URL}/classify-thread-category`,
        {
          thread_id: threadId,
          subject,
          snippet,
          sender_email: senderEmail,
          sender_categories: senderCategories,
        },
        { timeout: 15000 },
      );
      return {
        categories: response.data.categories,
        noiseFiltered: response.data.noise_filtered,
        topicKey: response.data.topic_key ?? undefined,
        topicKeyConfidence: response.data.topic_key_confidence ?? undefined,
      };
    } catch (error: any) {
      console.error("AI classify-thread-category failed:", error.message);
      // Non-fatal: fallback to empty (will retry on next sync)
      return { categories: [], noiseFiltered: false };
    }
  }

  /**
   * Phase 3: Ask the AI service to generate a short human-friendly label
   * (2–5 words) for a topic based on its thread subjects.
   *
   * Falls back to the first subject string on any error.
   */
  async labelTopic(
    topicId: string,
    threadSubjects: string[],
    contactName?: string,
  ): Promise<{ name: string }> {
    try {
      const response = await axios.post<{ topic_id: string; name: string }>(
        `${AI_SERVICE_URL}/label-topic`,
        {
          mode: "label",
          topic_id: topicId,
          thread_subjects: threadSubjects,
          contact_name: contactName,
        },
        { timeout: 10_000 },
      );
      return { name: response.data.name ?? threadSubjects[0] ?? "Untitled" };
    } catch (error: any) {
      console.warn("[AIService.labelTopic]", error.message);
      return { name: threadSubjects[0] ?? "Untitled" };
    }
  }

  async consolidateTopics(
    contactId: string,
    contactName: string | undefined,
    candidates: TopicConsolidationCandidate[],
    minConfidence = 0.8,
  ): Promise<{
    clusters: TopicConsolidationCluster[];
    topicNameOverrides: TopicNameOverride[];
    unmergedTopicIds: string[];
  }> {
    try {
      const response = await axios.post<{
        mode: "consolidate";
        clusters?: TopicConsolidationCluster[];
        topic_name_overrides?: TopicNameOverride[];
        unmerged_topic_ids?: string[];
      }>(
        `${AI_SERVICE_URL}/label-topic`,
        {
          mode: "consolidate",
          contact_id: contactId,
          contact_name: contactName,
          candidates,
          min_confidence: minConfidence,
        },
        { timeout: 20_000 },
      );

      return {
        clusters: response.data.clusters ?? [],
        topicNameOverrides: response.data.topic_name_overrides ?? [],
        unmergedTopicIds: response.data.unmerged_topic_ids ?? [],
      };
    } catch (error: any) {
      console.warn("[AIService.consolidateTopics]", error.message);
      return { clusters: [], topicNameOverrides: [], unmergedTopicIds: [] };
    }
  }

  async suggestMerges(contacts: ContactSnippet[]): Promise<MergeSuggestion[]> {
    try {
      const response = await axios.post<SuggestMergeResponse>(
        `${AI_SERVICE_URL}/suggest-merge`,
        { contacts },
        { timeout: 60000 },
      );
      return response.data.suggestions;
    } catch (error: any) {
      console.error("AI suggest-merge failed:", error.message);
      throw new Error(
        `AI suggest-merge failed: ${
          error.response?.data?.detail || error.message
        }`,
      );
    }
  }
}
