"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

import { useThreads } from "@/hooks/useThreads";

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
  } = useThreads(20);

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
          // Extract sender name from participants (first one, excluding current user)
          const sender = thread.participants?.[0]
            ? thread.participants[0].replace(/<.*>/, "").trim() ||
              thread.participants[0]
            : "Unknown";

          return (
            <li key={thread._id}>
              <Link
                href={`/threads/${thread.id}`}
                className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-gray-50"
              >
                <div className="flex flex-1 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">
                      {sender}
                    </span>
                    {thread.subject && (
                      <span className="text-xs text-gray-500">
                        · {thread.subject}
                      </span>
                    )}
                  </div>
                  <span className="line-clamp-2 text-sm text-gray-600">
                    {thread.snippet || "(No preview available)"}
                  </span>
                </div>
                <div className="ml-3 shrink-0 text-xs text-gray-500">
                  {thread.lastMessageDate
                    ? formatDistanceToNow(new Date(thread.lastMessageDate), {
                        addSuffix: true,
                      })
                    : ""}
                </div>
              </Link>
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
