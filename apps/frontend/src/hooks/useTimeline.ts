import useSWR from "swr";
import apiClient from "@/lib/api";

export interface TimelineItemDTO {
  type: "email" | "telegram";
  id: string; // threadId | messageId
  date: string;
  isOutbound: boolean;
  
  // Email specific
  subject?: string;
  snippet?: string;
  threadId?: string;
  
  // Telegram specific
  text?: string;
  chatId?: string;
  senderId?: string;
}

export function useUnifiedTimeline(contactId: string) {
  const { data, error, isLoading, mutate } = useSWR<{ timeline: TimelineItemDTO[] }>(
    `/api/contacts/${contactId}/timeline`,
    async (url: string) => {
      const res = await apiClient.get(url);
      return res.data;
    }
  );

  return {
    timeline: data?.timeline || [],
    isLoading,
    isError: error,
    mutate,
  };
}
