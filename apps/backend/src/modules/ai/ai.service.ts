import axios from "axios";
import { IThreadSummary } from "@/models/Thread";

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
  summary: string;
  key_issues: string[];
  action_required: string[];
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

export type { EnrichContactResponse, MergeSuggestion, ReplyItem };

export class AIService {
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
  ): Promise<{ categories: string[]; noiseFiltered: boolean }> {
    try {
      const response = await axios.post<{
        thread_id: string;
        categories: string[];
        noise_filtered: boolean;
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
