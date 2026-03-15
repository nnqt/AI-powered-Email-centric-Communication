import useSWR from "swr";
import apiClient from "@/lib/api";

export interface ChatInsightDTO {
  _id: string;
  intent: string;
  summary: string;
  sourceChatId: string;
  date: string;
}

export interface TopicDTO {
  _id: string;
  name: string;
  nameEditedByUser: boolean;
  threadCount: number;
  noiseCount: number;
  focusScore: number;
  unansweredCount: number;
  lastInboundAt?: string;
  lastOutboundAt?: string;
  aiLabeled: boolean;
  chatInsights?: ChatInsightDTO[];
}

export function useContactTopics(contactId: string) {
  const { data, error, isLoading, mutate } = useSWR<TopicDTO[]>(
    contactId ? `/api/contacts/${contactId}/topics` : null,
    async (url: string) => {
      const res = await apiClient.get<{ topics: TopicDTO[] }>(url);
      return res.data.topics;
    },
  );
  return { topics: data ?? [], isLoading, isError: !!error, mutate };
}
