"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { MessageCircle } from "lucide-react";
import apiClient from "@/lib/api";
import type { TopicDTO, ChatInsightDTO } from "@/hooks/useContactTopics";
import React from "react";
import { PriorityBadge } from "@/components/PriorityBadge";

interface ThreadMeta {
  _id: string;
  id: string;
  subject?: string;
  snippet?: string;
  lastMessageDate?: string;
  lastMessageDirection?: "inbound" | "outbound";
  isRead?: boolean;
}

interface Props {
  topic: TopicDTO;
  onRename?: (topicId: string, newName: string) => void;
}

export default function ContactTopicGroup({ topic, onRename }: Props) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [threads, setThreads] = useState<ThreadMeta[] | null>(null);
  const [loadingThreads, setLoadingThreads] = useState(false);

  const unifiedTimeline = React.useMemo(() => {
    if (!threads) return null;

    type TimelineItem =
      | { type: "email"; data: ThreadMeta; timestamp: number }
      | { type: "telegram"; data: ChatInsightDTO; timestamp: number };

    const items: TimelineItem[] = [];

    for (const t of threads) {
      items.push({
        type: "email",
        data: t,
        timestamp: t.lastMessageDate ? new Date(t.lastMessageDate).getTime() : 0,
      });
    }

    if (topic.chatInsights) {
      for (const insight of topic.chatInsights) {
        items.push({
          type: "telegram",
          data: insight,
          timestamp: new Date(insight.date).getTime(),
        });
      }
    }

    return items.sort((a, b) => b.timestamp - a.timestamp);
  }, [threads, topic.chatInsights]);

  // Rename state
  const [renaming, setRenaming] = useState(false);
  const [nameInput, setNameInput] = useState(topic.name);
  const [savingName, setSavingName] = useState(false);

  const handleToggle = async () => {
    if (!expanded && threads === null) {
      setLoadingThreads(true);
      try {
        const res = await apiClient.get<{ threads: ThreadMeta[] }>(
          `/api/topics/${topic._id}`,
        );
        setThreads(res.data.threads ?? []);
      } catch {
        setThreads([]);
      } finally {
        setLoadingThreads(false);
      }
    }
    setExpanded((v) => !v);
  };

  const handleRenameSubmit = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed || trimmed === topic.name) {
      setRenaming(false);
      return;
    }
    setSavingName(true);
    try {
      await apiClient.patch(`/api/topics/${topic._id}`, { name: trimmed });
      onRename?.(topic._id, trimmed);
      setRenaming(false);
    } catch {
      // keep renaming open on failure
    } finally {
      setSavingName(false);
    }
  };

  return (
    <div className="contact-topic-group rounded-xl border border-gray-200 bg-white overflow-hidden">
      {/* ── Topic header ── */}
      <button
        type="button"
        onClick={handleToggle}
        className="contact-topic-group__header w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
        aria-expanded={expanded}
      >
        {/* Expand chevron */}
        <svg
          className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${expanded ? "rotate-90" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.25 4.5l7.5 7.5-7.5 7.5"
          />
        </svg>

        {/* Topic name */}
        <div className="flex-1 min-w-0">
          {renaming ? (
            <div
              className="flex items-center gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                autoFocus
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRenameSubmit();
                  if (e.key === "Escape") setRenaming(false);
                }}
                className="flex-1 min-w-0 rounded-md border border-indigo-400 px-2 py-0.5 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={handleRenameSubmit}
                disabled={savingName}
                className="rounded bg-indigo-600 px-2.5 py-0.5 text-xs text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {savingName ? "…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setRenaming(false)}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="truncate text-sm font-semibold text-gray-800">
                {topic.name}
              </span>
              {topic.aiLabeled && !topic.nameEditedByUser && (
                <span className="shrink-0 text-[10px] text-purple-400 font-medium">
                  AI
                </span>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setNameInput(topic.name);
                  setRenaming(true);
                }}
                className="shrink-0 opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-gray-200 transition-opacity"
                title="Rename topic"
                tabIndex={-1}
              >
                <svg
                  className="h-3 w-3 text-gray-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Right-side badges */}
        <div className="flex items-center gap-1.5 shrink-0">
          {topic.unansweredCount > 0 && (
            <span
              className="inline-flex items-center rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white tabular-nums"
              title="Unanswered threads"
            >
              {topic.unansweredCount}
            </span>
          )}
          <span className="text-xs text-gray-400 tabular-nums">
            {topic.threadCount}t
          </span>
          <PriorityBadge score={topic.focusScore} />
        </div>
      </button>

      {/* ── Thread list ── */}
      {expanded && (
        <div className="contact-topic-group__threads border-t border-gray-100 divide-y divide-gray-50">
          {loadingThreads ? (
            <div className="px-6 py-4 text-center">
              <p className="text-xs text-gray-400">Loading threads…</p>
            </div>
          ) : unifiedTimeline && unifiedTimeline.length === 0 ? (
            <div className="px-6 py-4 text-center">
              <p className="text-xs text-gray-400">No emails or chat insights yet.</p>
            </div>
          ) : (
            unifiedTimeline?.map((item) => {
              if (item.type === "email") {
                const thread = item.data;
                return (
                  <div
                    key={`email-${thread._id}`}
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      router.push(`/threads/${thread.id || thread._id}`)
                    }
                    onKeyDown={(e) =>
                      e.key === "Enter" &&
                      router.push(`/threads/${thread.id || thread._id}`)
                    }
                    className="flex cursor-pointer items-start gap-3 px-6 py-2.5 hover:bg-gray-50 transition-colors"
                  >
                    {/* Direction dot */}
                    <div
                      className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                        thread.lastMessageDirection === "inbound"
                          ? "bg-indigo-500"
                          : "bg-emerald-500"
                      }`}
                      title={
                        thread.lastMessageDirection === "inbound"
                          ? "Inbound"
                          : "Outbound"
                      }
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={`truncate text-sm ${
                          !thread.isRead
                            ? "font-semibold text-gray-900"
                            : "text-gray-700"
                        }`}
                      >
                        {thread.subject ?? "(no subject)"}
                      </p>
                      {thread.snippet && (
                        <p className="truncate text-xs text-gray-400 mt-0.5">
                          {thread.snippet}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 text-xs text-gray-400 pt-0.5">
                      {thread.lastMessageDate
                        ? formatDistanceToNow(new Date(thread.lastMessageDate), {
                            addSuffix: true,
                          })
                        : ""}
                    </span>
                  </div>
                );
              } else {
                const insight = item.data;
                return (
                  <div key={`tg-${insight._id}`} className="px-6 py-2">
                     <div className="flex items-start gap-3 rounded-lg border-l-2 border-indigo-400 bg-indigo-50/50 px-3 py-2 transition-colors hover:bg-indigo-50">
                        <div className="mt-0.5 shrink-0 text-indigo-500">
                          <MessageCircle className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                           <p className="truncate text-sm font-semibold text-indigo-900">
                             {insight.intent}
                           </p>
                           <p className="text-xs text-indigo-700/80 line-clamp-2 mt-0.5">
                             {insight.summary}
                           </p>
                        </div>
                        <span className="shrink-0 text-xs text-indigo-400 pt-0.5">
                          {formatDistanceToNow(new Date(insight.date), {
                            addSuffix: true,
                          })}
                        </span>
                     </div>
                  </div>
                );
              }
            })
          )}
        </div>
      )}
    </div>
  );
}
