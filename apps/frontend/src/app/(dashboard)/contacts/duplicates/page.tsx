"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSWRConfig } from "swr";

import apiClient from "@/lib/api";
import { useToast } from "@/components/Toast";

interface MergeSuggestion {
  source_id: string;
  target_id: string;
  source_email: string;
  target_email: string;
  confidence: number;
  reason: string;
}

export default function ContactsDuplicatesPage() {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const { showToast, updateToast } = useToast();

  const [suggestions, setSuggestions] = useState<MergeSuggestion[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [mergingIds, setMergingIds] = useState<Set<string>>(new Set());
  const [checked, setChecked] = useState(false);

  const handleCheck = async () => {
    const toastId = showToast("Checking for duplicates…", "processing");
    try {
      const res = await apiClient.get<{ suggestions: MergeSuggestion[] }>(
        "/api/contacts/merge-suggestions",
      );
      setSuggestions(res.data.suggestions);
      setDismissedIds(new Set());
      setChecked(true);
      if (res.data.suggestions.length === 0) {
        updateToast(toastId, "No duplicate contacts found", "success");
      } else {
        updateToast(
          toastId,
          `Found ${res.data.suggestions.length} possible duplicate(s)`,
          "success",
        );
      }
    } catch {
      updateToast(toastId, "Failed to check duplicates", "error");
    }
  };

  const handleMerge = async (suggestion: MergeSuggestion) => {
    const key = `${suggestion.source_id}-${suggestion.target_id}`;
    setMergingIds((prev) => new Set(prev).add(key));
    const toastId = showToast(
      `Merging ${suggestion.source_email} → ${suggestion.target_email}…`,
      "processing",
    );
    try {
      await apiClient.post("/api/contacts/merge", {
        sourceId: suggestion.source_id,
        targetId: suggestion.target_id,
      });
      setSuggestions((prev) =>
        prev.filter(
          (s) =>
            !(
              s.source_id === suggestion.source_id &&
              s.target_id === suggestion.target_id
            ),
        ),
      );
      await mutate(
        (key: string) =>
          typeof key === "string" && key.startsWith("/api/contacts"),
      );
      updateToast(toastId, "Contacts merged", "success");
    } catch {
      updateToast(toastId, "Merge failed", "error");
    } finally {
      setMergingIds((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const handleDismiss = (suggestion: MergeSuggestion) => {
    const key = `${suggestion.source_id}-${suggestion.target_id}`;
    setDismissedIds((prev) => new Set(prev).add(key));
  };

  const visibleSuggestions = suggestions.filter(
    (s) => !dismissedIds.has(`${s.source_id}-${s.target_id}`),
  );

  return (
    <div className="contacts-duplicates flex flex-col h-full">
      {/* Topbar */}
      <header className="contacts-duplicates__topbar sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-gray-200 bg-white px-6">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700 transition-colors"
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
        <h1 className="text-base font-semibold text-gray-900">
          Check Duplicates
        </h1>
      </header>

      <main className="contacts-duplicates__content flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-2xl space-y-6">
          {/* Description card */}
          <div className="contacts-duplicates__info rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900 mb-1">
              Duplicate Contact Detection
            </h2>
            <p className="text-xs text-gray-500 mb-4">
              AI will scan your contacts for likely duplicates based on email
              similarity and other signals. You can review each suggestion and
              decide to merge or dismiss.
            </p>
            <button
              type="button"
              onClick={handleCheck}
              className="contacts-duplicates__check-btn inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                  clipRule="evenodd"
                />
              </svg>
              Scan for Duplicates
            </button>
          </div>

          {/* Results */}
          {checked && (
            <div className="contacts-duplicates__results">
              {visibleSuggestions.length === 0 ? (
                <div className="rounded-xl border border-green-200 bg-green-50 px-5 py-6 text-center">
                  <p className="text-sm font-medium text-green-800">
                    ✓ No duplicate contacts found
                  </p>
                  <p className="mt-1 text-xs text-green-600">
                    Your contact list looks clean.
                  </p>
                </div>
              ) : (
                <div className="contacts-duplicates__suggestions rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <h3 className="mb-3 text-sm font-semibold text-amber-800">
                    🔀 Possible duplicates ({visibleSuggestions.length})
                  </h3>
                  <div className="space-y-2">
                    {visibleSuggestions.map((s) => {
                      const key = `${s.source_id}-${s.target_id}`;
                      const isMerging = mergingIds.has(key);
                      return (
                        <div
                          key={key}
                          className="contacts-duplicates__suggestion-card flex items-center justify-between rounded-lg border border-amber-200 bg-white px-4 py-3 gap-4"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-gray-900">
                              {s.source_email}{" "}
                              <span className="text-gray-400">→</span>{" "}
                              {s.target_email}
                            </p>
                            <p className="truncate text-xs text-gray-500 mt-0.5">
                              {s.reason} &nbsp;·&nbsp; confidence:{" "}
                              {Math.round(s.confidence * 100)}%
                            </p>
                          </div>
                          <div className="contacts-duplicates__suggestion-actions flex shrink-0 gap-2">
                            <button
                              type="button"
                              onClick={() => handleMerge(s)}
                              disabled={isMerging}
                              className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50 transition-colors"
                            >
                              {isMerging ? "Merging…" : "Merge"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDismiss(s)}
                              disabled={isMerging}
                              className="rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                            >
                              Dismiss
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
