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

export class AIService {
  async summarizeThread(
    threadId: string,
    messages: Array<{
      id: string;
      from?: string;
      to: string[];
      date?: Date;
      body?: string;
    }>
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
        { timeout: 30000 }
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
        }`
      );
    }
  }
}
