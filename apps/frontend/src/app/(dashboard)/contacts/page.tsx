"use client";

import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import useSWR from "swr";

import { useContacts, ContactDTO } from "@/hooks/useContacts";
import type { ContactCategory } from "@/hooks/useContacts";
import apiClient from "@/lib/api";

const ALL_CATEGORIES: ContactCategory[] = [
  "colleague",
  "customer",
  "other",
  "spam",
];

const CATEGORY_FILTER_TABS: {
  value: ContactCategory | "all";
  label: string;
}[] = [
  { value: "all", label: "All" },
  { value: "colleague", label: "Colleague" },
  { value: "customer", label: "Customer" },
  { value: "other", label: "Other" },
  { value: "spam", label: "Spam" },
];

const CATEGORY_CHIP_STYLE: Record<ContactCategory, string> = {
  colleague: "bg-blue-50 text-blue-700 ring-blue-200",
  customer: "bg-green-50 text-green-700 ring-green-200",
  other: "bg-gray-100 text-gray-600 ring-gray-200",
  spam: "bg-red-50 text-red-600 ring-red-200",
  unknown: "bg-gray-100 text-gray-400 ring-gray-200",
};

/** Inline contact row for the Verify tab. */
function VerifyContactRow({
  contact,
  onVerified,
}: {
  contact: ContactDTO;
  onVerified: (contactId: string) => void;
}) {
  const router = useRouter();
  const suggestion = contact.categoryAiSuggestion as
    | ContactCategory
    | undefined;
  const [selected, setSelected] = useState<Set<ContactCategory>>(
    () => new Set(suggestion ? [suggestion] : []),
  );
  const [confirming, setConfirming] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [localSuggestion, setLocalSuggestion] = useState<
    ContactCategory | undefined
  >(suggestion);

  const toggle = (cat: ContactCategory) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const handleConfirm = async () => {
    if (selected.size === 0) return;
    setConfirming(true);
    try {
      const cats = Array.from(selected);
      await apiClient.patch(`/api/contacts/${contact._id}`, {
        categories: cats,
        category: cats[0],
        categorySource: "user",
        categoryAiSuggestion: null,
      });
      onVerified(contact._id);
    } catch {
      // silent
    } finally {
      setConfirming(false);
    }
  };

  const handleAISuggest = async () => {
    setEnriching(true);
    try {
      const res = await apiClient.post<{ contact: ContactDTO }>(
        `/api/contacts/${contact._id}/enrich`,
      );
      const updated = res.data.contact;
      if (updated.categoryAiSuggestion) {
        setLocalSuggestion(updated.categoryAiSuggestion as ContactCategory);
        setSelected(new Set([updated.categoryAiSuggestion as ContactCategory]));
      }
    } catch {
      // silent
    } finally {
      setEnriching(false);
    }
  };

  const initials = contact.name
    ? contact.name
        .split(" ")
        .map((w) => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : contact.email[0].toUpperCase();

  return (
    <div className="verify-contact-row flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push(`/contacts/${contact._id}`)}
          className="verify-contact-row__avatar flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700 hover:opacity-80"
        >
          {initials}
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-gray-900">
            {contact.name ?? contact.email}
          </p>
          {contact.name && (
            <p className="truncate text-xs text-gray-500">{contact.email}</p>
          )}
          {contact.org && (
            <p className="truncate text-xs text-gray-400">{contact.org}</p>
          )}
        </div>
        {!contact.aiEnriched && !localSuggestion && (
          <button
            type="button"
            onClick={handleAISuggest}
            disabled={enriching}
            className="shrink-0 flex items-center gap-1 rounded-md border border-purple-200 bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-50"
          >
            {enriching ? (
              <svg
                className="h-3 w-3 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8z"
                />
              </svg>
            ) : (
              <span>✦</span>
            )}
            AI
          </button>
        )}
      </div>

      {/* Category chips */}
      <div className="flex flex-wrap gap-2">
        {ALL_CATEGORIES.map((cat) => {
          const isSelected = selected.has(cat);
          const isAISuggestion = cat === localSuggestion;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => toggle(cat)}
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition-all ${
                isSelected
                  ? `${CATEGORY_CHIP_STYLE[cat]} ring-2 font-semibold`
                  : "bg-gray-50 text-gray-500 ring-gray-200 hover:bg-gray-100"
              }`}
            >
              {cat}
              {isAISuggestion && (
                <span className="rounded bg-purple-100 px-1 text-[9px] font-bold uppercase text-purple-600">
                  AI
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={selected.size === 0 || confirming}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-40"
        >
          {confirming ? "Saving…" : "Confirm"}
        </button>
        <button
          type="button"
          onClick={() => onVerified(contact._id)}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          Skip
        </button>
      </div>
    </div>
  );
}

const unverifiedFetcher = async (url: string) => {
  const res = await apiClient.get<{ contacts: ContactDTO[]; total: number }>(
    url,
  );
  return res.data;
};

function useUnverifiedContacts() {
  const { data, isLoading, mutate } = useSWR(
    "/api/contacts?unverified=true&limit=200",
    unverifiedFetcher,
  );
  return {
    contacts: data?.contacts ?? [],
    total: data?.total ?? 0,
    isLoading,
    mutate,
  };
}

function ContactRow({
  contact,
  onClick,
}: {
  contact: ContactDTO;
  onClick: () => void;
}) {
  const initials = contact.name
    ? contact.name
        .split(" ")
        .map((w) => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : contact.email[0].toUpperCase();

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      className="contact-row flex cursor-pointer items-center gap-4 rounded-lg px-4 py-3 hover:bg-gray-50 transition-colors"
    >
      <div className="contact-row__avatar flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
        {initials}
      </div>
      <div className="contact-row__info min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">
          {contact.name ?? contact.email}
        </p>
        {contact.name && (
          <p className="truncate text-xs text-gray-500">{contact.email}</p>
        )}
      </div>
      <div className="contact-row__badges flex shrink-0 gap-2">
        {contact.org && (
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
            {contact.org}
          </span>
        )}
        {contact.language && (
          <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700">
            {contact.language}
          </span>
        )}
        {contact.aiEnriched && (
          <span className="rounded-full bg-purple-50 px-2 py-0.5 text-xs text-purple-700">
            AI ✓
          </span>
        )}
        {contact.telegramId && (
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700 flex items-center gap-1">
            <svg
              className="h-3 w-3"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.892-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
            </svg>
            TG
          </span>
        )}
      </div>
    </div>
  );
}

export default function ContactsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mainTab, setMainTab] = useState<"directory" | "verify">("directory");
  const {
    contacts,
    total,
    hasNext,
    isLoading,
    skip,
    goToNext,
    goToPrev,
    search,
    setSearch,
    categoryFilter,
    setCategoryFilter,
    mutate,
  } = useContacts(30);

  const {
    contacts: unverifiedContacts,
    total: unverifiedTotal,
    isLoading: unverifiedLoading,
    mutate: mutateUnverified,
  } = useUnverifiedContacts();

  // Local dismissed list for optimistic "skip" behaviour
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const verifyContacts = unverifiedContacts.filter(
    (c) => !dismissedIds.has(c._id),
  );

  const handleVerified = useCallback(
    (contactId: string) => {
      setDismissedIds((prev) => new Set(prev).add(contactId));
      mutateUnverified();
    },
    [mutateUnverified],
  );

  const [bulkEnriching, setBulkEnriching] = useState(false);
  const [bulkResult, setBulkResult] = useState<{
    processed: number;
    failed: number;
    total: number;
  } | null>(null);

  async function handleBulkEnrich() {
    setBulkEnriching(true);
    setBulkResult(null);
    try {
      const res = await apiClient.post<{
        processed: number;
        failed: number;
        total: number;
      }>("/api/contacts/bulk-enrich");
      setBulkResult(res.data);
      await mutate();
    } catch {
      setBulkResult({ processed: 0, failed: -1, total: 0 });
    } finally {
      setBulkEnriching(false);
    }
  }

  // Pre-populate search from ?q= URL param (e.g. from sender link in thread detail)
  useEffect(() => {
    const q = searchParams.get("q");
    if (q) setSearch(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === "loading") {
    return (
      <div className="flex min-h-full items-center justify-center py-20">
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    );
  }

  if (status === "unauthenticated") {
    router.replace("/");
    return null;
  }

  return (
    <div className="contacts-page flex flex-col h-full">
      {/* Topbar */}
      <header className="contacts-page__topbar sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b border-gray-200 bg-white px-6">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold text-gray-900">Contacts</h1>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
            {total}
          </span>
          {/* Main tab switcher */}
          <div className="ml-4 flex gap-1 rounded-lg bg-gray-100 p-0.5">
            {(["directory", "verify"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setMainTab(tab)}
                className={`relative rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  mainTab === tab
                    ? "bg-white text-indigo-700 shadow-sm"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                {tab === "directory" ? "Directory" : "Verify"}
                {tab === "verify" && unverifiedTotal > 0 && (
                  <span className="ml-1 rounded-full bg-amber-400 px-1.5 text-[10px] font-bold text-white">
                    {unverifiedTotal}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {bulkResult && bulkResult.failed === -1 && (
            <span className="text-xs text-red-500">Enrich failed</span>
          )}
          {bulkResult && bulkResult.failed !== -1 && (
            <span className="text-xs text-gray-500">
              Enriched {bulkResult.processed}/{bulkResult.total}
              {bulkResult.failed > 0 && ` (${bulkResult.failed} failed)`}
            </span>
          )}
          <button
            type="button"
            onClick={handleBulkEnrich}
            disabled={bulkEnriching}
            className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 transition-colors"
          >
            {bulkEnriching ? (
              <>
                <svg
                  className="h-3.5 w-3.5 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8z"
                  />
                </svg>
                Enriching…
              </>
            ) : (
              <>✦ Enrich All</>
            )}
          </button>
        </div>
      </header>

      {/* ── Verify tab panel ── */}
      {mainTab === "verify" && (
        <div className="contacts-page__verify flex-1 overflow-y-auto px-6 py-4">
          <p className="mb-4 text-sm text-gray-500">
            {verifyContacts.length > 0
              ? `${verifyContacts.length} contact(s) without a confirmed category. Assign categories to help AI prioritize your inbox.`
              : "All contacts have been verified. ✓"}
          </p>
          {unverifiedLoading ? (
            <div className="flex items-center justify-center py-16">
              <p className="text-sm text-gray-500">Loading…</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {verifyContacts.map((c) => (
                <VerifyContactRow
                  key={c._id}
                  contact={c}
                  onVerified={handleVerified}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Directory tab panel ── */}
      {mainTab === "directory" && (
        <div className="contacts-page__list flex-1 overflow-y-auto px-6 py-4">
          {/* Search bar */}
          <div className="contacts-page__search relative mb-2">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                clipRule="evenodd"
              />
            </svg>
            <input
              type="text"
              placeholder="Search by name, email, or org…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-4 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            )}
          </div>

          {/* Category filter tabs */}
          <div className="contacts-page__filters flex items-center gap-1 border-b border-gray-200 mb-4">
            {CATEGORY_FILTER_TABS.map((tab) => {
              const isActive = categoryFilter === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setCategoryFilter(tab.value)}
                  className={`relative px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "text-indigo-600"
                      : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  {tab.label}
                  {isActive && (
                    <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-indigo-600" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="contacts-page__items rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <p className="text-sm text-gray-500">Loading contacts…</p>
              </div>
            ) : contacts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <p className="text-sm font-medium text-gray-700">
                  {search
                    ? `No contacts matching "${search}"`
                    : "No contacts yet"}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {search
                    ? "Try a different search term."
                    : "Contacts are automatically created when you sync emails."}
                </p>
              </div>
            ) : (
              contacts.map((c) => (
                <ContactRow
                  key={c._id}
                  contact={c}
                  onClick={() => router.push(`/contacts/${c._id}`)}
                />
              ))
            )}
          </div>

          {/* Pagination */}
          {total > 30 && (
            <div className="contacts-page__pagination mt-4 flex items-center justify-between text-sm text-gray-500">
              <span>
                {skip + 1}–{Math.min(skip + contacts.length, total)} of {total}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={goToPrev}
                  disabled={skip === 0}
                  className="rounded border border-gray-300 px-3 py-1 hover:bg-gray-50 disabled:opacity-40"
                >
                  ← Newer
                </button>
                <button
                  type="button"
                  onClick={goToNext}
                  disabled={!hasNext}
                  className="rounded border border-gray-300 px-3 py-1 hover:bg-gray-50 disabled:opacity-40"
                >
                  Older →
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
