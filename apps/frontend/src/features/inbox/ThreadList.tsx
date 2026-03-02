"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

import { useThreads } from "@/hooks/useThreads";
import apiClient from "@/lib/api";

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
      <div className="space-y-2">
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
      <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
        Failed to load threads.
      </div>
    );
  }

  if (!threads || threads.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
        No conversations yet. Try syncing your inbox.
      </div>
    );
  }

  const startIndex = (currentPage - 1) * 20 + 1;
  const endIndex = startIndex + threads.length - 1;

  return (
    <div className="space-y-3">
      {/* Gmail-style pagination header */}
      <div className="flex items-center justify-between text-sm text-gray-600">
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
      <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 bg-white">
        {threads.map((thread) => {
          const isRead = thread.isRead ?? true;
          const sender = thread.participants?.[0]
            ? thread.participants[0].replace(/<.*>/, "").trim() ||
              thread.participants[0]
            : "Unknown";

          return (
            <li key={thread._id} className="group relative">
              <Link
                href={`/threads/${thread.id}`}
                className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-gray-50"
              >
                {/* Unread dot */}
                <div className="mt-1.5 flex-shrink-0">
                  <span
                    className={`block h-2 w-2 rounded-full ${
                      !isRead ? "bg-indigo-500" : "bg-transparent"
                    }`}
                  />
                </div>

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
                      ? formatDistanceToNow(new Date(thread.lastMessageDate), {
                          addSuffix: true,
                        })
                      : ""}
                  </span>
                </div>
              </Link>

              {/* Hover action buttons */}
              <div className="absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-1 group-hover:flex">
                {/* Toggle read/unread */}
                <button
                  type="button"
                  onClick={(e) => handleToggleRead(e, thread.id, isRead)}
                  title={isRead ? "Mark as unread" : "Mark as read"}
                  className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                >
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    {isRead ? (
                      // Envelope open (mark unread)
                      <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                    ) : (
                      // Envelope (mark read)
                      <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                    )}
                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                  </svg>
                </button>

                {/* Archive */}
                <button
                  type="button"
                  onClick={(e) => handleArchive(e, thread.id)}
                  title="Archive"
                  className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                >
                  <svg
                    className="h-4 w-4"
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
            </li>
          );
        })}
      </ul>

      {/* Gmail-style pagination footer */}
      <div className="flex items-center justify-end">
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
