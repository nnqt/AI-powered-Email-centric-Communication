"use client";

import useSWR from "swr";
import { useState } from "react";

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
  participants?: string[];
  subject?: string;
  createdAt?: string;
  updatedAt?: string;
  summary?: ThreadSummary;
}

export interface PaginatedThreadsResponse {
  threads: ThreadDTO[];
  total: number;
  hasNext: boolean;
  hasPrev: boolean;
}

const fetcher = async (url: string): Promise<PaginatedThreadsResponse> => {
  const response = await apiClient.get<PaginatedThreadsResponse>(url);
  return response.data;
};

export function useThreads(limit: number = 20) {
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);

  const url = cursor ? `/api/threads?limit=${limit}&cursor=${cursor}` : `/api/threads?limit=${limit}`;

  const { data, error, isLoading, mutate } = useSWR<PaginatedThreadsResponse>(
    url,
    fetcher
  );

  const goToNextPage = () => {
    if (data?.threads && data.threads.length > 0) {
      const lastThread = data.threads[data.threads.length - 1];
      const newCursor = `${lastThread.lastMessageDate}_${lastThread._id}`;
      setCursor(newCursor);
      setPage((prev) => prev + 1);
    }
  };

  const goToPrevPage = () => {
    // Reset to first page
    setCursor(undefined);
    setPage(1);
  };

  return {
    threads: data?.threads || [],
    total: data?.total || 0,
    hasNext: data?.hasNext || false,
    hasPrev: data?.hasPrev || false,
    currentPage: page,
    isLoading,
    isError: !!error,
    mutate,
    goToNextPage,
    goToPrevPage,
  };
}
