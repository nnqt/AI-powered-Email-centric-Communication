"use client";

import { useState } from "react";

import apiClient from "@/lib/api";

export interface ReplyItem {
  subject: string | null;
  body: string;
}

interface SmartReplyBarProps {
  threadId: string;
  /** Called when user clicks a suggestion — fills the compose drawer */
  onSelect: (reply: ReplyItem) => void;
}

type ReplyFormat = "message" | "email";

export function SmartReplyBar({ threadId, onSelect }: SmartReplyBarProps) {
  const [format, setFormat] = useState<ReplyFormat>("message");
  const [replies, setReplies] = useState<ReplyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState(false);

  const handleGenerate = async (fmt: ReplyFormat = format) => {
    setLoading(true);
    setError(null);
    setReplies([]);
    try {
      const res = await apiClient.post<{
        format: string;
        replies: ReplyItem[];
      }>(`/api/threads/${threadId}/suggest-reply`, { format: fmt });
      setReplies(res.data.replies ?? []);
      setGenerated(true);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Failed to generate suggestions.");
    } finally {
      setLoading(false);
    }
  };

  const handleFormatChange = (fmt: ReplyFormat) => {
    setFormat(fmt);
    setGenerated(false);
    setReplies([]);
  };

  const handleSelect = (reply: ReplyItem) => {
    onSelect(reply);
    setReplies([]);
    setGenerated(false);
  };

  return (
    <div className="smart-reply-bar mb-4 rounded-lg border border-indigo-100 bg-indigo-50 p-3 space-y-2">
      {/* Header row */}
      <div className="smart-reply-bar__header flex items-center justify-between">
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

        <div className="flex items-center gap-1">
          {/* Format toggle */}
          <div className="smart-reply-bar__format-toggle flex rounded-md border border-indigo-200 overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => handleFormatChange("message")}
              className={`px-2 py-1 transition-colors ${
                format === "message"
                  ? "bg-indigo-600 text-white"
                  : "bg-white text-indigo-600 hover:bg-indigo-50"
              }`}
            >
              💬 Message
            </button>
            <button
              type="button"
              onClick={() => handleFormatChange("email")}
              className={`px-2 py-1 transition-colors ${
                format === "email"
                  ? "bg-indigo-600 text-white"
                  : "bg-white text-indigo-600 hover:bg-indigo-50"
              }`}
            >
              ✉ Email
            </button>
          </div>

          {/* Generate / Regenerate */}
          <button
            type="button"
            onClick={() => handleGenerate(format)}
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
            ) : generated ? (
              "↻ Regenerate"
            ) : (
              "Generate"
            )}
          </button>
        </div>
      </div>

      {error && (
        <p className="smart-reply-bar__error text-xs text-red-600">{error}</p>
      )}

      {/* Reply chips / cards */}
      {replies.length > 0 && (
        <>
          {format === "message" ? (
            /* Compact chips for message format */
            <div className="smart-reply-bar__chips flex flex-wrap gap-2">
              {replies.map((reply, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelect(reply)}
                  className="max-w-xs truncate rounded-full border border-indigo-200 bg-white px-3 py-1 text-left text-xs text-indigo-800 hover:border-indigo-400 hover:bg-indigo-50"
                  title={reply.body}
                >
                  {reply.body}
                </button>
              ))}
            </div>
          ) : (
            /* Expanded cards for email format */
            <div className="smart-reply-bar__cards space-y-2">
              {replies.map((reply, idx) => (
                <div
                  key={idx}
                  className="smart-reply-bar__reply-card rounded-md border border-indigo-200 bg-white p-3 text-xs"
                >
                  {reply.subject && (
                    <p className="mb-1 font-medium text-gray-700">
                      Subject: {reply.subject}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap text-gray-600 line-clamp-4">
                    {reply.body}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleSelect(reply)}
                    className="mt-2 rounded bg-indigo-600 px-2.5 py-1 text-white hover:bg-indigo-700"
                  >
                    Use this reply
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {!generated && !loading && replies.length === 0 && (
        <p className="smart-reply-bar__hint text-xs text-indigo-500">
          Choose a format and click &ldquo;Generate&rdquo; to get AI-powered
          reply ideas.
        </p>
      )}
    </div>
  );
}
