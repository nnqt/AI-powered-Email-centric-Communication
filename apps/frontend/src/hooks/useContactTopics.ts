import useSWR from "swr";
import apiClient from "@/lib/api";

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
