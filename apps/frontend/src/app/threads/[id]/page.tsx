"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";

import { useThreadDetail } from "@/hooks/useThreadDetail";
import { AISummaryCard } from "@/components/AISummaryCard";
import apiClient from "@/lib/api";

export default function ThreadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const threadId = params.id as string;

  const { thread, messages, isLoading, isError, mutate } =
    useThreadDetail(threadId);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleSummarize = async () => {
    setIsGenerating(true);
    try {
      await apiClient.post(`/api/threads/${threadId}/summarize`);
      await mutate();
    } catch (error) {
      console.error("Failed to generate summary:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-4xl px-4 py-8">
          <div className="space-y-4">
            <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
            <div className="h-24 w-full animate-pulse rounded bg-gray-200" />
            <div className="h-32 w-full animate-pulse rounded bg-gray-200" />
          </div>
        </div>
      </main>
    );
  }

  if (isError || !thread) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-4xl px-4 py-8">
          <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
            Failed to load thread details.
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-4 text-sm text-indigo-600 hover:underline"
        >
          ← Back to Inbox
        </button>

        <header className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">
            {messages?.[0]?.subject || "Thread Detail"}
          </h1>
          <p className="text-sm text-gray-500">
            {messages?.length || 0} message(s)
          </p>
        </header>

        <AISummaryCard
          summary={thread.summary}
          onGenerate={handleSummarize}
          isGenerating={isGenerating}
        />

        <section className="space-y-4">
          {messages?.map((msg) => (
            <article
              key={msg._id}
              className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-800">
                  {msg.from || "Unknown Sender"}
                </span>
                <span className="text-xs text-gray-500">
                  {msg.date
                    ? formatDistanceToNow(new Date(msg.date), {
                        addSuffix: true,
                      })
                    : ""}
                </span>
              </div>
              {msg.to && msg.to.length > 0 && (
                <p className="mb-2 text-xs text-gray-500">
                  To: {msg.to.join(", ")}
                </p>
              )}
              <div
                className="prose prose-sm max-w-none text-gray-700"
                dangerouslySetInnerHTML={{
                  __html: msg.body || msg.snippet || "",
                }}
              />
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
