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
}

interface SuggestReplyResponse {
  thread_id: string;
  replies: string[];
}

interface EnrichContactRequest {
  email: string;
  name?: string;
  conversation_snippet?: string;
}

interface EnrichContactResponse {
  email: string;
  display_name: string | null;
  org: string | null;
  language: string | null;
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

export type { EnrichContactResponse, MergeSuggestion };

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
  ): Promise<string[]> {
    const payload: SuggestReplyRequest = {
      thread_id: threadId,
      conversation_context: context,
      latest_message: {
        id: latestMessage.id,
        from_: latestMessage.from || "",
        text: latestMessage.text,
      },
      max_replies: maxReplies,
    };

    try {
      const response = await axios.post<SuggestReplyResponse>(
        `${AI_SERVICE_URL}/suggest-reply`,
        payload,
        { timeout: 30000 },
      );
      return response.data.replies;
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
  ): Promise<EnrichContactResponse> {
    const payload: EnrichContactRequest = {
      email,
      name,
      conversation_snippet: conversationSnippet,
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
