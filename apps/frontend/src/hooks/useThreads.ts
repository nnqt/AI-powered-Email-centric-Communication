"use client";

import useSWR from "swr";
import { useState, useEffect, useRef } from "react";

import apiClient from "@/lib/api";

export type ThreadFilter = "all" | "unread" | "archived";

export interface ThreadSummary {
  text: string;
  key_issues: string[];
  action_required: string[];
}

export interface ThreadDTO {
  _id: string;
  id: string;
  userId: string;
  isMock?: boolean;
  historyId?: string;
  snippet?: string;
  lastMessageDate?: string;
  participants?: string[];
  subject?: string;
  createdAt?: string;
  updatedAt?: string;
  summary?: ThreadSummary;
  isRead?: boolean;
  isArchived?: boolean;
  isUrgent?: boolean;
  urgentClassifiedAt?: string;
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

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export function useThreads(limit: number = 20) {
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<ThreadFilter>("all");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 350);

  // Reset pagination when filter or search changes
  const prevFilterRef = useRef(filter);
  const prevSearchRef = useRef(debouncedSearch);
  useEffect(() => {
    if (
      prevFilterRef.current !== filter ||
      prevSearchRef.current !== debouncedSearch
    ) {
      prevFilterRef.current = filter;
      prevSearchRef.current = debouncedSearch;
      setCursor(undefined);
      setPage(1);
    }
  }, [filter, debouncedSearch]);

  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set("cursor", cursor);
  if (filter !== "all") params.set("filter", filter);
  if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim());
  const url = `/api/threads?${params.toString()}`;

  const { data, error, isLoading, mutate } = useSWR<PaginatedThreadsResponse>(
    url,
    fetcher,
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
    filter,
    setFilter,
    search,
    setSearch,
  };
}
