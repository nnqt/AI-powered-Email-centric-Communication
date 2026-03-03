"use client";

import useSWR from "swr";
import { useState } from "react";

import apiClient from "@/lib/api";

export interface ContactDTO {
  _id: string;
  email: string;
  name?: string;
  org?: string;
  language?: string;
  alternateEmails: string[];
  aiEnriched: boolean;
  mergedInto?: string;
  createdAt: string;
  updatedAt: string;
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

export function useContacts(limit = 30) {
  const [skip, setSkip] = useState(0);

  const url = `/api/contacts?limit=${limit}&skip=${skip}`;
  const { data, error, isLoading, mutate } = useSWR<PaginatedContactsResponse>(
    url,
    fetcher,
    { keepPreviousData: true },
  );

  return {
    contacts: data?.contacts ?? [],
    total: data?.total ?? 0,
    hasNext: data?.hasNext ?? false,
    isLoading,
    isError: !!error,
    mutate,
    skip,
    goToNext: () => setSkip((s) => s + limit),
    goToPrev: () => setSkip((s) => Math.max(0, s - limit)),
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
