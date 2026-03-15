import useSWR from "swr";
import apiClient from "@/lib/api";

export interface TelegramChatDTO {
  _id: string;
  chatId: string;
  title: string;
  type: "private" | "group" | "channel";
  lastMessageDate: string;
  unreadCount: number;
}

const fetcher = (url: string) => apiClient.get(url).then((res) => res.data.chats);

export function useTelegramChats() {
  const { data, error, isLoading, mutate } = useSWR<TelegramChatDTO[]>(
    "/api/telegram/chats",
    fetcher,
    {
      refreshInterval: 0, // We rely on Socket.IO for updates
    }
  );

  return {
    chats: data || [],
    isLoading,
    isError: error,
    mutate,
  };
}
