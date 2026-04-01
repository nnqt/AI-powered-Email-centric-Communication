"use client";

import React, { useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { MessageCircle } from "lucide-react";

import type { FocusTopicDTO } from "@/hooks/useFocusTopics";
import type { ChatInsightDTO } from "@/hooks/useContactTopics";
import apiClient from "@/lib/api";

interface Thread {
  _id: string;
  id: string;
  subject?: string;
  snippet?: string;
  lastMessageDate?: string;
  lastMessageDirection?: "inbound" | "outbound";
  isRead?: boolean;
  categories?: string[];
}

interface ThreadsResponse {
  threads: Thread[];
}

interface Props {
  topic: FocusTopicDTO;
  onRename?: (topicId: string, newName: string) => void;
}

/** Single-letter avatar from name or email. */
function ContactAvatar({ name, email }: { name?: string; email: string }) {
  const letter = (name?.[0] ?? email[0])?.toUpperCase();
  return (
    <div className="focus-topic-card__avatar flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
      {letter}
    </div>
  );
}

/** Category badge chip. */
const CATEGORY_STYLES: Record<string, string> = {
  colleague: "bg-blue-50 text-blue-700",
  customer: "bg-green-50 text-green-700",
  spam: "bg-red-50 text-red-600",
  other: "bg-gray-100 text-gray-600",
  unknown: "bg-gray-100 text-gray-400",
};

function CategoryChip({ category }: { category: string }) {
  return (
    <span
      className={`focus-topic-card__category-chip inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_STYLES[category] ?? CATEGORY_STYLES.unknown}`}
    >
      {category}
    </span>
  );
}

export function FocusTopicCard({ topic, onRename }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [loadingThreads, setLoadingThreads] = useState(false);

  // useMemo computes the unified timeline every time threads or topic.chatInsights change
  const unifiedTimeline = React.useMemo(() => {
    if (!threads) return null;

    type TimelineItem =
      | { type: "email"; data: Thread; timestamp: number }
      | { type: "telegram"; data: ChatInsightDTO; timestamp: number };

    const items: TimelineItem[] = [];

    // 1. Add email threads
    for (const t of threads) {
      items.push({
        type: "email",
        data: t,
        timestamp: t.lastMessageDate ? new Date(t.lastMessageDate).getTime() : 0,
      });
    }

    // 2. Add telegram insights
    if (topic.chatInsights) {
      for (const insight of topic.chatInsights) {
        items.push({
          type: "telegram",
          data: insight,
          timestamp: new Date(insight.date).getTime(),
        });
      }
    }

    // 3. Sort descending by timestamp
    return items.sort((a, b) => b.timestamp - a.timestamp);
  }, [threads, topic.chatInsights]);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(topic.name);

  const lastInbound = topic.lastInboundAt
    ? formatDistanceToNow(new Date(topic.lastInboundAt), { addSuffix: true })
    : null;

  const handleExpand = async () => {
    const next = !expanded;
    setExpanded(next);
    if (next && threads === null) {
      setLoadingThreads(true);
      try {
        const res = await apiClient.get<ThreadsResponse>(
          `/api/topics/${topic._id}`,
        );
        setThreads((res.data as any).threads ?? []);
      } catch {
        setThreads([]);
      } finally {
        setLoadingThreads(false);
      }
    }
  };

  const handleRename = async () => {
    const trimmed = editName.trim();
    if (!trimmed || trimmed === topic.name) {
      setEditing(false);
      setEditName(topic.name);
      return;
    }
    try {
      await apiClient.patch(`/api/topics/${topic._id}`, { name: trimmed });
      onRename?.(topic._id, trimmed);
    } catch {
      setEditName(topic.name);
    }
    setEditing(false);
  };

  return (
    <article className="focus-topic-card rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      {/* Card header */}
      <div
        className="focus-topic-card__header flex cursor-pointer select-none items-start gap-3 p-4"
        onClick={handleExpand}
        role="button"
        tabIndex={0}
        onKeyDown={(e) =>
          (e.key === "Enter" || e.key === " ") && handleExpand()
        }
        aria-expanded={expanded}
      >
        <ContactAvatar name={topic.contact.name} email={topic.contact.email} />

        <div className="focus-topic-card__meta min-w-0 flex-1">
          {/* Topic name + rename */}
          <div className="focus-topic-card__name-row mb-0.5 flex items-center gap-2">
            {editing ? (
              <input
                autoFocus
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={handleRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRename();
                  if (e.key === "Escape") {
                    setEditing(false);
                    setEditName(topic.name);
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                className="focus-topic-card__name-input flex-1 rounded border border-indigo-300 px-2 py-0.5 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
            ) : (
              <span className="truncate text-sm font-semibold text-gray-900">
                {topic.name}
              </span>
            )}

            {/* Edit icon — stop propagation so it doesn't toggle expand */}
            {!editing && (
              <button
                type="button"
                title="Rename topic"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditing(true);
                }}
                className="focus-topic-card__rename-btn shrink-0 rounded p-0.5 text-gray-300 opacity-0 transition-opacity hover:text-gray-500 group-hover:opacity-100"
              >
                <svg
                  className="h-3.5 w-3.5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
              </button>
            )}
          </div>

          {/* Contact info */}
          <p className="focus-topic-card__contact-info mb-1 truncate text-xs text-gray-500">
            {topic.contact.name
              ? `${topic.contact.name} · ${topic.contact.email}`
              : topic.contact.email}
            {topic.contact.org && ` · ${topic.contact.org}`}
          </p>

        </div>

        {/* Right-side stats */}
        <div className="focus-topic-card__stats ml-2 flex shrink-0 flex-col items-end gap-1.5 text-right">
          {topic.unansweredCount > 0 && (
            <span className="focus-topic-card__unanswered inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
              {topic.unansweredCount} unanswered
            </span>
          )}
          <span className="focus-topic-card__thread-count text-xs text-gray-400">
            {topic.threadCount} thread{topic.threadCount !== 1 ? "s" : ""}
          </span>
          {lastInbound && (
            <span className="focus-topic-card__last-inbound text-xs text-gray-400">
              {lastInbound}
            </span>
          )}
          <CategoryChip category={topic.contact.category} />

          {/* Chevron */}
          <svg
            className={`h-4 w-4 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      </div>

      {/* Expanded thread list */}
      {expanded && (
        <div className="focus-topic-card__threads border-t border-gray-100 px-4 pb-3 pt-2">
          {loadingThreads && (
            <p className="py-3 text-center text-xs text-gray-400">Loading…</p>
          )}

          {!loadingThreads && unifiedTimeline?.length === 0 && (
            <p className="py-3 text-center text-xs text-gray-400">
              No emails or chat insights yet.
            </p>
          )}

          {!loadingThreads && unifiedTimeline && unifiedTimeline.length > 0 && (
            <ul className="focus-topic-card__thread-list divide-y divide-gray-50">
              {unifiedTimeline.map((item) => {
                if (item.type === "email") {
                  const t = item.data;
                  return (
                    <li key={`email-${t._id}`} className="focus-topic-card__thread-item">
                      <Link
                        href={`/threads/${t.id}`}
                        className="flex items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-gray-50"
                      >
                        {/* Inbound / outbound indicator */}
                        <span
                          title={
                            t.lastMessageDirection === "inbound"
                              ? "Unread / awaiting reply"
                              : "You replied"
                          }
                          className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                            t.lastMessageDirection === "inbound"
                              ? "bg-red-400"
                              : "bg-green-400"
                          }`}
                        />
                        <div className="min-w-0 flex-1">
                          <p
                            className={`truncate text-xs ${!t.isRead ? "font-semibold text-gray-900" : "text-gray-600"}`}
                          >
                            {t.subject ?? "(No subject)"}
                          </p>
                          {t.snippet && (
                            <p className="truncate text-xs text-gray-400">
                              {t.snippet}
                            </p>
                          )}
                        </div>
                        {t.lastMessageDate && (
                          <span className="shrink-0 text-xs text-gray-400">
                            {formatDistanceToNow(new Date(t.lastMessageDate), {
                              addSuffix: true,
                            })}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                } else {
                  const insight = item.data;
                  return (
                    <li key={`tg-${insight._id}`} className="focus-topic-card__insight-item py-2">
                       <div className="flex items-start gap-3 rounded-lg border-l-2 border-indigo-400 bg-indigo-50/50 px-2 py-2 transition-colors hover:bg-indigo-50">
                          <div className="mt-0.5 shrink-0 text-indigo-500">
                            <MessageCircle className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                             <p className="truncate text-xs font-semibold text-indigo-900">
                               {insight.intent}
                             </p>
                             <p className="text-xs text-indigo-700/80 line-clamp-2 mt-0.5">
                               {insight.summary}
                             </p>
                          </div>
                          <span className="shrink-0 text-xs text-indigo-400">
                            {formatDistanceToNow(new Date(insight.date), {
                              addSuffix: true,
                            })}
                          </span>
                       </div>
                    </li>
                  );
                }
              })}
            </ul>
          )}

          <div className="focus-topic-card__thread-footer mt-2 flex justify-end">
            <Link
              href={`/contacts/${topic.contactId}`}
              className="text-xs text-indigo-600 hover:text-indigo-800"
              onClick={(e) => e.stopPropagation()}
            >
              View contact →
            </Link>
          </div>
        </div>
      )}
    </article>
  );
}
