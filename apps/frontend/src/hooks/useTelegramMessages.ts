import useSWR from "swr";
import apiClient from "@/lib/api";
import { TelegramChatDTO } from "./useTelegramChats";

export interface TelegramMessageDTO {
  _id: string;
  messageId: string;
  chatId: string;
  senderId: string;
  text: string;
  date: string;
  isOutbound: boolean;
}

interface ChatDetailsResponse {
  chat: TelegramChatDTO;
  messages: TelegramMessageDTO[];
}

const fetcher = (url: string) => apiClient.get(url).then((res) => res.data);

export function useTelegramMessages(chatId?: string) {
  const { data, error, isLoading, mutate } = useSWR<ChatDetailsResponse>(
    chatId ? `/api/telegram/chats/${chatId}` : null,
    fetcher
  );

  return {
    chat: data?.chat,
    messages: data?.messages || [],
    isLoading,
    isError: error,
    mutate,
  };
}
