"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

import { useThreads, ThreadFilter } from "@/hooks/useThreads";
import apiClient from "@/lib/api";

const FILTER_TABS: { value: ThreadFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "archived", label: "Archived" },
];

export function ThreadList() {
  const {
    threads,
    total,
    hasNext,
    hasPrev,
    currentPage,
    isLoading,
    isError,
    goToNextPage,
    goToPrevPage,
    mutate,
    filter,
    setFilter,
    search,
    setSearch,
  } = useThreads(20);

  const handleToggleRead = async (
    e: React.MouseEvent,
    threadId: string,
    currentlyRead: boolean,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    // Optimistic update
    mutate(
      (prev) =>
        prev
          ? {
              ...prev,
              threads: prev.threads.map((t) =>
                t.id === threadId ? { ...t, isRead: !currentlyRead } : t,
              ),
            }
          : prev,
      false,
    );
    try {
      await apiClient.patch(`/api/threads/${threadId}/read`, {
        read: !currentlyRead,
      });
    } catch {
      mutate(); // Revert on error
    }
  };

  const handleArchive = async (e: React.MouseEvent, threadId: string) => {
    e.preventDefault();
    e.stopPropagation();
    // Optimistic remove from list
    mutate(
      (prev) =>
        prev
          ? {
              ...prev,
              threads: prev.threads.filter((t) => t.id !== threadId),
              total: prev.total - 1,
            }
          : prev,
      false,
    );
    try {
      await apiClient.patch(`/api/threads/${threadId}/archive`);
    } catch {
      mutate(); // Revert on error
    }
  };

  if (isLoading) {
    return (
      <div className="thread-list thread-list--loading space-y-3">
        {/* Search skeleton */}
        <div className="h-9 w-full animate-pulse rounded-lg bg-gray-100" />
        {/* Tab skeleton */}
        <div className="flex gap-2 border-b border-gray-200 pb-2">
          {[80, 64, 80, 72].map((w, i) => (
            <div
              key={i}
              className="h-5 animate-pulse rounded bg-gray-100"
              style={{ width: w }}
            />
          ))}
        </div>
        {Array.from({ length: 5 }).map((_, idx) => (
          <div
            key={idx}
            className="h-14 w-full animate-pulse rounded-md bg-gray-100"
          />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="thread-list__error rounded-md bg-red-50 p-4 text-sm text-red-700">
        Failed to load threads.
      </div>
    );
  }

  if (!threads || threads.length === 0) {
    return (
      <div className="thread-list thread-list--empty space-y-3">
        {/* Search bar */}
        <div className="thread-list__search relative">
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
            placeholder="Search emails…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-4 text-sm text-gray-900 placeholder-gray-700 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          )}
        </div>
        {/* Filter tabs */}
        <div className="thread-list__filters flex items-center gap-1 border-b border-gray-200">
          {FILTER_TABS.map((tab) => {
            const isActive = filter === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setFilter(tab.value)}
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
        <div className="thread-list__empty-state rounded-md border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
          {search
            ? `No results for "${search}"`
            : filter === "unread"
              ? "No unread emails"
              : filter === "archived"
                ? "No archived emails"
                : "No conversations yet. Try syncing your inbox."}
        </div>
      </div>
    );
  }

  const startIndex = (currentPage - 1) * 20 + 1;
  const endIndex = startIndex + threads.length - 1;

  return (
    <div className="thread-list space-y-3">
      {/* Search bar */}
      <div className="thread-list__search relative">
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
          placeholder="Search emails…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-4 text-sm text-gray-900 placeholder-gray-700 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="thread-list__filters flex items-center gap-1 border-b border-gray-200">
        {FILTER_TABS.map((tab) => {
          const isActive = filter === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setFilter(tab.value)}
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

      {/* Pagination header */}
      <div className="thread-list__pagination flex items-center justify-between text-sm text-gray-600">
        <span>
          {startIndex}–{endIndex} of {total.toLocaleString()}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goToPrevPage}
            disabled={!hasPrev}
            className="rounded px-3 py-1 text-sm hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-400 disabled:hover:bg-transparent"
            title="Newer"
          >
            ← Newer
          </button>
          <button
            type="button"
            onClick={goToNextPage}
            disabled={!hasNext}
            className="rounded px-3 py-1 text-sm hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-400 disabled:hover:bg-transparent"
            title="Older"
          >
            Older →
          </button>
        </div>
      </div>

      {/* Thread list */}
      <ul className="thread-list__items divide-y divide-gray-200 rounded-md border border-gray-200 bg-white">
        {threads.map((thread) => {
          const isRead = thread.isRead ?? true;
          const sender = thread.participants?.[0]
            ? thread.participants[0].replace(/<.*>/, "").trim() ||
              thread.participants[0]
            : "Unknown";

          return (
            <li key={thread._id} className="thread-list__item">
              <div className="flex items-center hover:bg-gray-50 transition-colors">
                {/* Left: action buttons — always visible */}
                <div className="thread-list__item-actions flex shrink-0 items-center pl-2 pr-1">
                  {/* Toggle read/unread */}
                  <button
                    type="button"
                    onClick={(e) => handleToggleRead(e, thread.id, isRead)}
                    title={isRead ? "Mark as unread" : "Mark as read"}
                    className="rounded p-1 text-gray-300 hover:bg-gray-200 hover:text-gray-600 transition-colors"
                  >
                    <svg
                      className="h-3.5 w-3.5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      {isRead ? (
                        <>
                          <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                          <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                        </>
                      ) : (
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      )}
                    </svg>
                  </button>
                  {/* Archive */}
                  <button
                    type="button"
                    onClick={(e) => handleArchive(e, thread.id)}
                    title="Archive"
                    className="rounded p-1 text-gray-300 hover:bg-gray-200 hover:text-gray-600 transition-colors"
                  >
                    <svg
                      className="h-3.5 w-3.5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z" />
                      <path
                        fillRule="evenodd"
                        d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </div>

                {/* Unread dot */}
                <div className="thread-list__item-indicator shrink-0 px-1.5">
                  <span
                    className={`block h-2 w-2 rounded-full ${
                      !isRead ? "bg-indigo-500" : "bg-transparent"
                    }`}
                  />
                </div>

                {/* Link wraps content + metadata */}
                <Link
                  href={`/threads/${thread.id}`}
                  className="flex flex-1 items-center gap-3 py-3 pr-4 min-w-0"
                >
                  <div className="flex flex-1 flex-col gap-1 overflow-hidden">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm ${
                          !isRead
                            ? "font-bold text-gray-900"
                            : "font-medium text-gray-700"
                        }`}
                      >
                        {sender}
                      </span>
                      {thread.isMock && (
                        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700">
                          [MOCK]
                        </span>
                      )}
                      {thread.subject && (
                        <span className="truncate text-xs text-gray-500">
                          · {thread.subject}
                        </span>
                      )}
                    </div>
                    <span className="line-clamp-1 text-sm text-gray-600">
                      {thread.snippet || "(No preview available)"}
                    </span>
                  </div>

                  <div className="ml-2 flex shrink-0 flex-col items-end gap-1">
                    <span className="text-xs text-gray-500">
                      {thread.lastMessageDate
                        ? formatDistanceToNow(
                            new Date(thread.lastMessageDate),
                            { addSuffix: true },
                          )
                        : ""}
                    </span>
                  </div>
                </Link>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Gmail-style pagination footer */}
      <div className="thread-list__pagination-footer flex items-center justify-end">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <button
            type="button"
            onClick={goToPrevPage}
            disabled={!hasPrev}
            className="rounded px-3 py-1 hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-400 disabled:hover:bg-transparent"
            title="Newer"
          >
            ← Newer
          </button>
          <button
            type="button"
            onClick={goToNextPage}
            disabled={!hasNext}
            className="rounded px-3 py-1 hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-400 disabled:hover:bg-transparent"
            title="Older"
          >
            Older →
          </button>
        </div>
      </div>
    </div>
  );
}
