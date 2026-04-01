"use client";

import { useState, useCallback } from "react";

import { useFocusTopics, FocusTopicDTO } from "@/hooks/useFocusTopics";
import { FocusTopicCard } from "@/features/focus/FocusTopicCard";
import apiClient from "@/lib/api";
import { scoreToPriority } from "@/components/PriorityBadge";

type FocusLevelTab = "high" | "medium";

export default function FocusPage() {
  const { topics: rawTopics, isLoading, error, mutate } = useFocusTopics(30);
  const [topics, setTopics] = useState<FocusTopicDTO[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<FocusLevelTab>("high");

  // Use local state when we have mutations (rename), otherwise fall through to SWR data
  const displayTopics = topics ?? rawTopics;
  const visibleTopics = displayTopics.filter((topic) => {
    const level = scoreToPriority(topic.focusScore);
    if (activeTab === "high") {
      return level === "critical" || level === "high";
    }
    return level === "medium";
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await apiClient.post<{ topics: FocusTopicDTO[] }>(
        "/api/focus/recompute?limit=30",
      );
      setTopics(res.data.topics ?? null);
      await mutate(res.data.topics ?? [], false);
    } catch {
      // silent
    } finally {
      setRefreshing(false);
    }
  };

  const handleRename = useCallback(
    (topicId: string, newName: string) => {
      setTopics((prev) => {
        const base = prev ?? rawTopics;
        return base.map((t) =>
          t._id === topicId
            ? { ...t, name: newName, nameEditedByUser: true }
            : t,
        );
      });
    },
    [rawTopics],
  );

  return (
    <div className="focus-page flex flex-col h-full">
      {/* Topbar */}
      <header className="focus-page__topbar sticky top-0 z-10 flex h-14 items-center justify-between border-b border-gray-200 bg-white px-6">
        <div className="flex items-center gap-2">
          <h1 className="text-base font-semibold text-gray-900">Focus</h1>
          {visibleTopics.length > 0 && (
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
              {visibleTopics.length}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="focus-page__refresh-btn flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50 transition-colors"
        >
          <svg
            className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
              clipRule="evenodd"
            />
          </svg>
          {refreshing ? "Recalculating…" : "Refresh scores"}
        </button>
      </header>

      {/* Content */}
      <main className="focus-page__content flex-1 overflow-y-auto px-6 py-5">
        {!isLoading && !error && (
          <div className="focus-page__tabs mb-4 inline-flex items-center rounded-lg border border-gray-200 bg-white p-1 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab("high")}
              className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                activeTab === "high"
                  ? "bg-indigo-600 text-white"
                  : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              High
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("medium")}
              className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                activeTab === "medium"
                  ? "bg-indigo-600 text-white"
                  : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              Medium
            </button>
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading && (
          <ul className="focus-page__skeleton space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <li
                key={i}
                className="h-20 animate-pulse rounded-xl border border-gray-100 bg-gray-50"
              />
            ))}
          </ul>
        )}

        {/* Error */}
        {!isLoading && error && (
          <div className="focus-page__error rounded-xl border border-red-100 bg-red-50 p-6 text-center">
            <p className="text-sm font-medium text-red-700">
              Failed to load focus topics.
            </p>
            <button
              type="button"
              onClick={() => mutate()}
              className="mt-2 text-xs text-red-600 underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && visibleTopics.length === 0 && (
          <div className="focus-page__empty flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50 text-indigo-400">
              <svg className="h-7 w-7" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                <path
                  fillRule="evenodd"
                  d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-700">
              No {activeTab} priority topics
            </p>
            <p className="mt-1 max-w-xs text-xs text-gray-400">
              Topics will appear here once emails are synced and clustered.
              Switch tab or click "Refresh scores" to recalculate.
            </p>
          </div>
        )}

        {/* Topic cards */}
        {!isLoading && !error && visibleTopics.length > 0 && (
          <div className="focus-page__description mb-4">
            <p className="text-xs text-gray-400">
              Showing {activeTab} priority topics ranked by urgency.
            </p>
          </div>
        )}
        {!isLoading && !error && (
          <ul className="focus-page__list space-y-3">
            {visibleTopics.map((topic) => (
              <li key={topic._id} className="group">
                <FocusTopicCard topic={topic} onRename={handleRename} />
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
