"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { useSession } from "next-auth/react";

import { useThreadDetail } from "@/hooks/useThreadDetail";
import { AISummaryCard } from "@/components/AISummaryCard";
import { ComposeDrawer } from "@/components/ComposeDrawer";
import { SmartReplyBar } from "@/components/SmartReplyBar";
import { useSocket } from "@/hooks/useSocket";
import apiClient from "@/lib/api";

function normalizeMessageBody(content: string): string {
  return content
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t");
}

function looksLikeHtml(content: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(content);
}

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
  const [expandedMessages, setExpandedMessages] = useState<Record<string, boolean>>({});

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
      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="space-y-4">
          <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
          <div className="h-24 w-full animate-pulse rounded bg-gray-200" />
          <div className="h-32 w-full animate-pulse rounded bg-gray-200" />
        </div>
      </div>
    );
  }

  if (isError || !thread) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
          Failed to load thread details.
        </div>
      </div>
    );
  }

  return (
    <div className="thread-detail min-h-full bg-gray-50">
      <div className="thread-detail__container mx-auto max-w-3xl px-6 py-6">
        <button
          type="button"
          onClick={() => router.back()}
          className="thread-detail__back mb-4 flex items-center gap-1 text-sm text-indigo-600 hover:underline"
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
              clipRule="evenodd"
            />
          </svg>
          Back
        </button>

        <header className="thread-detail__header mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              {messages?.[0]?.subject || thread.subject || "Thread Detail"}
            </h1>
            <p className="text-sm text-gray-500">
              {messages?.length || 0} message(s)
            </p>
            {thread.isUrgent && (
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
                  🔴 Urgent
                </span>
                {thread.urgentClassifiedAt && (
                  <span className="text-xs text-gray-400">
                    AI classified{" "}
                    {formatDistanceToNow(new Date(thread.urgentClassifiedAt), {
                      addSuffix: true,
                    })}
                  </span>
                )}
              </div>
            )}
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

        <SmartReplyBar threadId={threadId} />

        <section className="thread-detail__messages space-y-2">
          {messages?.map((msg, msgIdx) => {
            const isExpanded = expandedMessages[msg._id] === true; // Default collapsed
            const emailMatch = msg.from?.match(/[^\s<>]+@[^\s<>]+/);
            const fromEmail = emailMatch?.[0];
            const fromName =
              msg.from?.replace(/<[^>]*>/, "").trim() ||
              msg.from ||
              "Unknown Sender";
            const toDisplay = msg.to?.slice(0, 1).join(", ") || "";
            const toText = msg.to && msg.to.length > 1 ? `to ${msg.to.length} recipients` : `to ${toDisplay}`;
            return (
              <article
                key={msg._id}
                className="thread-detail__message rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden"
              >
                {/* Collapsible header */}
                <button
                  type="button"
                  onClick={() =>
                    setExpandedMessages((prev) => ({
                      ...prev,
                      [msg._id]: !prev[msg._id],
                    }))
                  }
                  className="w-full flex items-start justify-between gap-4 p-4 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <svg
                        className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${
                          isExpanded ? "rotate-90" : ""
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                      {fromEmail ? (
                        <Link
                          href={`/contacts?q=${encodeURIComponent(fromEmail)}`}
                          className="text-sm font-medium text-indigo-700 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {fromName}
                        </Link>
                      ) : (
                        <span className="text-sm font-medium text-gray-800">
                          {fromName}
                        </span>
                      )}
                      <span className="text-xs text-gray-500">
                        {msg.date
                          ? formatDistanceToNow(new Date(msg.date), {
                              addSuffix: true,
                            })
                          : ""}
                      </span>
                    </div>
                    {!isExpanded && (
                      <>
                        <p className="text-xs text-gray-500 mb-1">{toText}</p>
                        {msg.subject && (
                          <p className="text-xs font-medium text-gray-700 truncate mb-1">
                            {msg.subject}
                          </p>
                        )}
                        <p className="text-xs text-gray-600 line-clamp-1">
                          {msg.body || msg.snippet || "(No content)"}
                        </p>
                      </>
                    )}
                  </div>
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-gray-200 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        {msg.to && msg.to.length > 0 && (
                          <p className="mb-1 text-xs text-gray-500">
                            To: {msg.to.join(", ")}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedMessages((prev) => ({
                            ...prev,
                            [msg._id]: false,
                          }))
                        }
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        ▲ Collapse
                      </button>
                    </div>
                    {(() => {
                      const normalizedContent = normalizeMessageBody(
                        msg.body || msg.snippet || "",
                      );

                      if (!looksLikeHtml(normalizedContent)) {
                        return (
                          <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-700">
                            {normalizedContent}
                          </div>
                        );
                      }

                      return (
                        <div
                          className="prose prose-sm max-w-none text-gray-700"
                          dangerouslySetInnerHTML={{
                            __html: normalizedContent,
                          }}
                        />
                      );
                    })()}
                  </div>
                )}
              </article>
            );
          })}
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
    </div>
  );
}
