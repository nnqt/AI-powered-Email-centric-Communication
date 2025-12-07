"use client";

import useSWR from "swr";

import apiClient from "@/lib/api";

export interface ThreadSummary {
  text: string;
  key_issues: string[];
  action_required: string[];
}

export interface ThreadDTO {
  _id: string;
  id: string;
  userId: string;
  historyId?: string;
  snippet?: string;
  lastMessageDate?: string;
  createdAt?: string;
  updatedAt?: string;
  summary?: ThreadSummary;
}

const fetcher = async (url: string): Promise<ThreadDTO[]> => {
  const response = await apiClient.get<ThreadDTO[]>(url);
  return response.data;
};

export function useThreads() {
  const { data, error, isLoading, mutate } = useSWR<ThreadDTO[]>(
    "/api/threads",
    fetcher
  );

  return {
    threads: data,
    isLoading,
    isError: !!error,
    mutate,
  };
}
