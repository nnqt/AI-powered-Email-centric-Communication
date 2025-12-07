"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

import { useThreads } from "@/hooks/useThreads";

export function ThreadList() {
  const { threads, isLoading, isError } = useThreads();

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

  return (
    <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 bg-white">
      {threads.map((thread) => (
        <li key={thread._id}>
          <Link
            href={`/threads/${thread.id}`}
            className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-gray-50"
          >
            <div className="flex flex-1 flex-col">
              <span className="text-xs font-medium text-gray-600">
                Sender placeholder
              </span>
              <span className="line-clamp-2 text-sm text-gray-900">
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
      ))}
    </ul>
  );
}
