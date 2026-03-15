"use client";

import useSWR from "swr";

import apiClient from "@/lib/api";
import type { PaginatedThreadsResponse } from "./useThreads";

const fetcher = async (url: string): Promise<number> => {
  const response = await apiClient.get<PaginatedThreadsResponse>(url);
  return response.data.total;
};

/**
 * Returns the total number of unread threads.
 * Polls every 60 s so the badge stays fresh without requiring a manual sync.
 */
export function useUnreadCount() {
  const { data = 0 } = useSWR<number>(
    "/api/threads?filter=unread&limit=1",
    fetcher,
    { refreshInterval: 60_000, revalidateOnFocus: true },
  );

  return data;
}
