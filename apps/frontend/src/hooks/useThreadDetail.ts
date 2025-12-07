"use client";

import useSWR from "swr";

import apiClient from "@/lib/api";
import { ThreadDTO, ThreadSummary } from "./useThreads";

export interface MessageDTO {
  _id: string;
  id: string;
  threadId: string;
  userId: string;
  from?: string;
  to: string[];
  subject?: string;
  body?: string;
  snippet?: string;
  date?: string;
  labelIds: string[];
}

export interface ThreadDetailResponse {
  thread: ThreadDTO;
  messages: MessageDTO[];
}

const fetcher = async (url: string): Promise<ThreadDetailResponse> => {
  const response = await apiClient.get<ThreadDetailResponse>(url);
  return response.data;
};

export function useThreadDetail(threadId: string) {
  const { data, error, isLoading, mutate } = useSWR<ThreadDetailResponse>(
    threadId ? `/api/threads/${threadId}` : null,
    fetcher
  );

  return {
    thread: data?.thread,
    messages: data?.messages,
    isLoading,
    isError: !!error,
    mutate,
  };
}
