"use client";

import useSWR from "swr";

import apiClient from "@/lib/api";

export interface ThreadDTO {
  _id: string;
  id: string;
  subject?: string;
  snippet?: string;
  lastMessageDate?: string;
  lastMessageDirection?: "inbound" | "outbound";
  isRead?: boolean;
}

export interface ChatInsightDTO {
  _id: string;
  intent: string;
  summary: string;
  sourceChatId: string;
  date: string;
}

export interface FocusContactDTO {
  _id: string;
  email: string;
  name?: string;
  org?: string;
  category: string;
  categories: string[];
}

export interface FocusTopicDTO {
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
  contact: FocusContactDTO;
}

interface FocusResponse {
  topics: FocusTopicDTO[];
}

const fetcher = async (url: string): Promise<FocusTopicDTO[]> => {
  const res = await apiClient.get<FocusResponse>(url);
  return res.data.topics;
};

export function useFocusTopics(limit = 20) {
  const { data, error, isLoading, mutate } = useSWR<FocusTopicDTO[]>(
    `/api/focus?limit=${limit}`,
    fetcher,
    { revalidateOnFocus: true, refreshInterval: 120_000 },
  );

  return {
    topics: data ?? [],
    isLoading,
    error,
    mutate,
  };
}
