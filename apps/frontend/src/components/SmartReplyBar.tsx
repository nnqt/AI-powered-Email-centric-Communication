"use client";

import { useState } from "react";

import apiClient from "@/lib/api";

interface SmartReplyBarProps {
  threadId: string;
  /** Called when user clicks a suggestion chip — fills the compose drawer */
  onSelect: (reply: string) => void;
}

export function SmartReplyBar({ threadId, onSelect }: SmartReplyBarProps) {
  const [replies, setReplies] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.post<{ replies: string[] }>(
        `/api/threads/${threadId}/suggest-reply`,
      );
      setReplies(res.data.replies);
      setGenerated(true);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Failed to generate suggestions.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (reply: string) => {
    onSelect(reply);
    // Reset so user can re-generate if needed
    setReplies([]);
    setGenerated(false);
  };

  return (
    <div className="mb-4 rounded-lg border border-indigo-100 bg-indigo-50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-medium text-indigo-700">
          <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"
              clipRule="evenodd"
            />
          </svg>
          Smart Reply
        </span>

        {!generated && (
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading}
            className="rounded px-2.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center gap-1">
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
                    d="M4 12a8 8 0 018-8v8H4z"
                  />
                </svg>
                Generating…
              </span>
            ) : (
              "Generate suggestions"
            )}
          </button>
        )}

        {generated && (
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading}
            className="rounded px-2.5 py-1 text-xs text-indigo-500 hover:text-indigo-700 disabled:opacity-50"
          >
            ↻ Regenerate
          </button>
        )}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {replies.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {replies.map((reply, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSelect(reply)}
              className="max-w-xs truncate rounded-full border border-indigo-200 bg-white px-3 py-1 text-left text-xs text-indigo-800 hover:border-indigo-400 hover:bg-indigo-50"
              title={reply}
            >
              {reply}
            </button>
          ))}
        </div>
      )}

      {!generated && !loading && replies.length === 0 && (
        <p className="text-xs text-indigo-500">
          Click &ldquo;Generate suggestions&rdquo; to get AI-powered reply
          ideas.
        </p>
      )}
    </div>
  );
}
