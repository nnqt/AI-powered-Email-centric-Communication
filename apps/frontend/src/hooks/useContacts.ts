"use client";

import useSWR from "swr";
import { useState, useMemo } from "react";

import apiClient from "@/lib/api";

export type ContactCategory =
  | "colleague"
  | "customer"
  | "spam"
  | "other"
  | "unknown";

export type CategorySource = "rule" | "ai" | "user";

export interface ContactDTO {
  _id: string;
  email: string;
  isMock?: boolean;
  name?: string;
  org?: string;
  language?: string;
  alternateEmails: string[];
  aiEnriched: boolean;
  enrichedAt?: string;
  mergedInto?: string;
  createdAt: string;
  updatedAt: string;
  category: ContactCategory;
  categories: ContactCategory[];
  categorySource: CategorySource;
  categoryAiSuggestion?: ContactCategory;
  telegramId?: string;
  telegramUsername?: string;
  telegramName?: string;
}

export interface PaginatedContactsResponse {
  contacts: ContactDTO[];
  total: number;
  hasNext: boolean;
}

const fetcher = async (url: string): Promise<PaginatedContactsResponse> => {
  const response = await apiClient.get<PaginatedContactsResponse>(url);
  return response.data;
};

const PAGE_SIZE = 30;

export function useContacts(limit = PAGE_SIZE) {
  const [skip, setSkip] = useState(0);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<ContactCategory | "all">(
    "all",
  );

  // Fetch all contacts when filtering (large limit), else paginate
  const isFiltering = search.trim() !== "" || categoryFilter !== "all";
  const fetchLimit = isFiltering ? 500 : limit;
  const fetchSkip = isFiltering ? 0 : skip;

  const url = `/api/contacts?limit=${fetchLimit}&skip=${fetchSkip}`;
  const { data, error, isLoading, mutate } = useSWR<PaginatedContactsResponse>(
    url,
    fetcher,
    { keepPreviousData: true },
  );

  const allContacts = data?.contacts ?? [];

  // Client-side filter
  const filtered = useMemo(() => {
    let list = allContacts;
    if (categoryFilter !== "all") {
      list = list.filter((c) => (c.category ?? "unknown") === categoryFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.email.toLowerCase().includes(q) ||
          c.name?.toLowerCase().includes(q) ||
          c.org?.toLowerCase().includes(q),
      );
    }
    return list;
  }, [allContacts, categoryFilter, search]);

  // Client-side pagination when filtering
  const [filterPage, setFilterPage] = useState(0);
  const filtered_start = isFiltering ? filterPage * limit : 0;
  const filtered_end = isFiltering ? filtered_start + limit : filtered.length;
  const pageContacts = isFiltering
    ? filtered.slice(filtered_start, filtered_end)
    : filtered;
  const pageTotal = isFiltering ? filtered.length : (data?.total ?? 0);
  const currentSkip = isFiltering ? filtered_start : skip;

  return {
    contacts: pageContacts,
    total: pageTotal,
    hasNext: isFiltering
      ? filtered_end < filtered.length
      : (data?.hasNext ?? false),
    isLoading,
    isError: !!error,
    mutate,
    skip: currentSkip,
    goToNext: () => {
      if (isFiltering) setFilterPage((p) => p + 1);
      else setSkip((s) => s + limit);
    },
    goToPrev: () => {
      if (isFiltering) setFilterPage((p) => Math.max(0, p - 1));
      else setSkip((s) => Math.max(0, s - limit));
    },
    search,
    setSearch: (v: string) => {
      setSearch(v);
      setFilterPage(0);
    },
    categoryFilter,
    setCategoryFilter: (v: ContactCategory | "all") => {
      setCategoryFilter(v);
      setFilterPage(0);
    },
  };
}

export function useContactDetail(contactId: string) {
  const { data, error, isLoading, mutate } = useSWR<ContactDTO>(
    contactId ? `/api/contacts/${contactId}` : null,
    async (url: string) => {
      const res = await apiClient.get<ContactDTO>(url);
      return res.data;
    },
  );
  return { contact: data, isLoading, isError: !!error, mutate };
}

export function useContactTimeline(contactId: string) {
  const { data, error, isLoading, mutate } = useSWR(
    contactId ? `/api/contacts/${contactId}/timeline` : null,
    async (url: string) => {
      const res = await apiClient.get<{ threads: any[] }>(url);
      return res.data;
    },
  );
  return { threads: data?.threads ?? [], isLoading, isError: !!error, mutate };
}
