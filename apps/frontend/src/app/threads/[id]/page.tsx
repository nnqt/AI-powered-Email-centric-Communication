"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { useSession } from "next-auth/react";

import { useThreadDetail } from "@/hooks/useThreadDetail";
import { AISummaryCard } from "@/components/AISummaryCard";
import { ComposeDrawer } from "@/components/ComposeDrawer";
import { SmartReplyBar, ReplyItem } from "@/components/SmartReplyBar";
import { useSocket } from "@/hooks/useSocket";
import apiClient from "@/lib/api";

export default function ThreadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const threadId = params.id as string;
  const { data: session } = useSession();
  const userId = (session?.user as any)?.id as string | undefined;

  const { thread, messages, isLoading, isError, mutate } =
    useThreadDetail(threadId);
  const [isGenerating, setIsGenerating] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [initialBody, setInitialBody] = useState("");
  const [subjectOverride, setSubjectOverride] = useState<string | null>(null);

  // Realtime: refresh thread detail when AI finishes summarizing this thread
  useSocket(userId, {
    SUMMARY_READY: (payload: { threadId: string }) => {
      if (payload.threadId === threadId) {
        mutate();
      }
    },
  });

  // Auto-mark as read when thread loads and is unread
  useEffect(() => {
    if (thread && thread.isRead === false) {
      apiClient
        .patch(`/api/threads/${threadId}/read`, { read: true })
        .catch(() => {
          /* non-critical */
        });
    }
  }, [thread?.isRead, threadId]);

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

  const handleOpenReply = (prefillBody = "") => {
    setInitialBody(prefillBody);
    setSubjectOverride(null);
    setComposeOpen(true);
  };

  const handleSelectReply = (reply: ReplyItem) => {
    setInitialBody(reply.body);
    setSubjectOverride(reply.subject ?? null);
    setComposeOpen(true);
  };

  const getReplyTo = () => {
    if (!messages || messages.length === 0) return "";
    const lastMsg = messages[messages.length - 1];
    return lastMsg.from || "";
  };

  const getReplySubject = () => {
    const subj = messages?.[0]?.subject || thread?.subject || "";
    return subj.startsWith("Re:") ? subj : `Re: ${subj}`;
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

        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              {messages?.[0]?.subject || thread.subject || "Thread Detail"}
            </h1>
            <p className="text-sm text-gray-500">
              {messages?.length || 0} message(s)
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleOpenReply()}
            className="flex shrink-0 items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M7.707 3.293a1 1 0 010 1.414L5.414 7H11a7 7 0 017 7v2a1 1 0 11-2 0v-2a5 5 0 00-5-5H5.414l2.293 2.293a1 1 0 11-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            Reply
          </button>
        </header>

        <AISummaryCard
          summary={thread.summary}
          onGenerate={handleSummarize}
          isGenerating={isGenerating}
        />

        <SmartReplyBar threadId={threadId} onSelect={handleSelectReply} />

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

      <ComposeDrawer
        open={composeOpen}
        onClose={() => {
          setComposeOpen(false);
          setSubjectOverride(null);
        }}
        initialTo={getReplyTo()}
        initialSubject={subjectOverride ?? getReplySubject()}
        initialBody={initialBody}
        replyToThreadId={thread.id}
        onSent={() => mutate()}
      />
    </main>
  );
}
