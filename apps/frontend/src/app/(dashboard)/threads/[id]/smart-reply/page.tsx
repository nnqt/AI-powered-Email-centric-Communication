"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

import apiClient from "@/lib/api";
import { useThreadDetail } from "@/hooks/useThreadDetail";
import { useToast } from "@/components/Toast";
import { ComposeDrawer } from "@/components/ComposeDrawer";

type ReplyFormat = "message" | "email";

interface ReplyItem {
  subject: string | null;
  body: string;
}

interface TimelineEntry {
  date: string;
  points: string[];
}

interface ParsedAction {
  priority?: string;
  deadline?: string;
  action: string;
}

function normalizeSummaryText(summary: unknown): string {
  if (typeof summary === "string") return summary;
  if (Array.isArray(summary)) {
    return summary
      .map((item) => (typeof item === "string" ? item : ""))
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

function normalizeActionItem(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (raw && typeof raw === "object") {
    const value = (raw as any).action ?? (raw as any).text ?? "";
    return typeof value === "string" ? value : "";
  }
  return "";
}

const USER_CONTEXT_BUDGET = 1200;
const ACTION_META_PATTERN = /^(.+?)\s*\(([^|]+)\s*\|\s*([^)]+)\)\s*$/i;

function parseActionItem(raw: string): ParsedAction {
  const normalized = raw.trim();
  const match = normalized.match(ACTION_META_PATTERN);

  if (!match) {
    return { action: normalized };
  }

  return {
    action: match[1].trim(),
    priority: match[2].trim(),
    deadline: match[3].trim(),
  };
}

function getPriorityBadgeClass(priority?: string): string {
  const value = (priority || "").toLowerCase();
  if (value.includes("cao")) {
    return "bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded-full text-xs font-medium";
  }
  if (value.includes("trung")) {
    return "bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full text-xs font-medium";
  }
  return "bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-full text-xs font-medium";
}

function getDisplayPriority(priority?: string): string {
  const value = (priority || "").toLowerCase();
  if (value.includes("cao")) return "Cao";
  if (value.includes("trung")) return "Trung bình";
  return "Thấp";
}

function parseTimelineSummary(summary: any): TimelineEntry[] {
  if (typeof summary === "string") {
    // Fallback: old format
    return [{ date: "Summary", points: [summary] }];
  }
  if (Array.isArray(summary)) {
    // New timeline format: ["Hôm nay sáng, point 1", "Hôm nay chiều, point 2", "Hôm qua, point 3"]
    const entries: Record<string, string[]> = {};
    summary.forEach((point: string) => {
      const match = point.match(/^([^,]+),\s*(.+)$/);
      if (match) {
        const date = match[1].trim();
        const content = match[2].trim();
        if (!entries[date]) entries[date] = [];
        entries[date].push(content);
      } else {
        if (!entries["Summary"]) entries["Summary"] = [];
        entries["Summary"].push(point);
      }
    });
    return Object.entries(entries).map(([date, points]) => ({ date, points }));
  }
  return [{ date: "Summary", points: [] }];
}

function buildContextPreview(args: {
  summaryText?: string;
  selectedNextActions: string[];
  additionalContext: string;
}) {
  const parts: string[] = [];

  if (args.summaryText) {
    parts.push(`Summary:\n${args.summaryText}`);
  }

  if (args.selectedNextActions.length > 0) {
    parts.push(
      `Selected next actions:\n${args.selectedNextActions
        .map((item) => `- ${item}`)
        .join("\n")}`,
    );
  }

  if (args.additionalContext.trim()) {
    parts.push(`Additional context:\n${args.additionalContext.trim()}`);
  }

  return parts.join("\n\n").trim();
}

export default function SmartReplyStudioPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { showToast, updateToast } = useToast();

  const threadId = params.id as string;
  const initialFormat = (searchParams.get("format") || "email") as ReplyFormat;

  const { thread, messages, isLoading, isError, mutate } = useThreadDetail(threadId);

  const [format, setFormat] = useState<ReplyFormat>(
    initialFormat === "message" ? "message" : "email",
  );
  const [selectedNextActions, setSelectedNextActions] = useState<string[]>([]);
  const [additionalContext, setAdditionalContext] = useState("");
  const [isRefreshingSummary, setIsRefreshingSummary] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [replies, setReplies] = useState<ReplyItem[]>([]);

  const [composeOpen, setComposeOpen] = useState(false);
  const [initialBody, setInitialBody] = useState("");
  const [subjectOverride, setSubjectOverride] = useState<string | null>(null);

  const overBudgetWarnedRef = useRef(false);

  const nextActions = useMemo(
    () =>
      Array.isArray(thread?.summary?.action_required)
        ? thread.summary.action_required
            .map((item: unknown) => normalizeActionItem(item))
            .map((item) => item.trim())
            .filter(Boolean)
        : [],
    [thread?.summary?.action_required],
  );
  const summaryText = useMemo(
    () => normalizeSummaryText(thread?.summary?.text),
    [thread?.summary?.text],
  );

  const userContextLength = useMemo(() => {
    return selectedNextActions.join("\n").length + additionalContext.length;
  }, [selectedNextActions, additionalContext]);

  const isOverBudget = userContextLength > USER_CONTEXT_BUDGET;

  const contextPreview = useMemo(
    () =>
      buildContextPreview({
        summaryText,
        selectedNextActions,
        additionalContext,
      }),
    [summaryText, selectedNextActions, additionalContext],
  );

  useEffect(() => {
    if (isOverBudget && !overBudgetWarnedRef.current) {
      showToast(
        `Context vượt giới hạn ${USER_CONTEXT_BUDGET} ký tự. Vui lòng bỏ bớt next actions hoặc rút gọn phần nhập tay.`,
        "warning",
      );
      overBudgetWarnedRef.current = true;
      return;
    }

    if (!isOverBudget && overBudgetWarnedRef.current) {
      overBudgetWarnedRef.current = false;
    }
  }, [isOverBudget, showToast]);

  const toggleNextAction = (action: string) => {
    setSelectedNextActions((prev) =>
      prev.includes(action)
        ? prev.filter((item) => item !== action)
        : [...prev, action],
    );
  };

  const handleRefreshSummary = async () => {
    const processingToastId = showToast("Đang cập nhật summary...", "processing");
    setIsRefreshingSummary(true);
    try {
      await apiClient.post(`/api/threads/${threadId}/summarize`);
      await mutate();
      updateToast(processingToastId, "Summary đã được cập nhật mới nhất.", "success");
    } catch {
      updateToast(
        processingToastId,
        "Không thể cập nhật summary. Vui lòng thử lại.",
        "error",
      );
    } finally {
      setIsRefreshingSummary(false);
    }
  };

  const handleGenerate = async () => {
    if (isOverBudget) {
      showToast(
        `Context đang là ${userContextLength}/${USER_CONTEXT_BUDGET}. Hãy rút gọn trước khi generate.`,
        "warning",
      );
      return;
    }

    if (!summaryText.trim() && selectedNextActions.length === 0) {
      showToast(
        "Bạn nên cập nhật Summary trước để lấy Next Actions mới nhất cho Smart Reply.",
        "info",
      );
    }

    setIsGenerating(true);
    setReplies([]);

    try {
      const res = await apiClient.post<{ format: string; replies: ReplyItem[] }>(
        `/api/threads/${threadId}/suggest-reply`,
        {
          format,
          selectedNextActions,
          additionalContext,
        },
      );
      setReplies(res.data.replies ?? []);
      if ((res.data.replies ?? []).length === 0) {
        showToast("AI chưa tạo được gợi ý. Vui lòng thử lại.", "warning");
      }
    } catch (err: any) {
      const code = err?.response?.data?.code;
      if (code === "CONTEXT_BUDGET_EXCEEDED") {
        const current = err?.response?.data?.currentLength;
        const budget = err?.response?.data?.budget;
        showToast(
          `Context vượt giới hạn (${current}/${budget}). Vui lòng rút gọn nội dung.`,
          "warning",
        );
      } else {
        showToast(err?.response?.data?.error || "Generate Smart Reply thất bại.", "error");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const getReplyTo = () => {
    if (!messages || messages.length === 0) return "";
    const lastMessage = messages[messages.length - 1];
    return lastMessage.from || "";
  };

  const getReplySubject = () => {
    const baseSubject = messages?.[0]?.subject || thread?.subject || "";
    return baseSubject.startsWith("Re:") ? baseSubject : `Re: ${baseSubject}`;
  };

  const handleUseReply = (reply: ReplyItem) => {
    setInitialBody(reply.body);
    setSubjectOverride(reply.subject ?? null);
    setComposeOpen(true);
  };

  if (isLoading) {
    return (
      <div className="smart-reply-studio min-h-full bg-gray-50">
        <div className="smart-reply-studio__container mx-auto max-w-4xl px-6 py-6">
          <div className="space-y-4">
            <div className="h-8 w-64 animate-pulse rounded bg-gray-200" />
            <div className="h-28 w-full animate-pulse rounded bg-gray-200" />
            <div className="h-32 w-full animate-pulse rounded bg-gray-200" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !thread) {
    return (
      <div className="smart-reply-studio min-h-full bg-gray-50">
        <div className="smart-reply-studio__container mx-auto max-w-4xl px-6 py-6">
          <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
            Failed to load Smart Reply Studio.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="smart-reply-studio min-h-full bg-gray-50">
      <div className="smart-reply-studio__container mx-auto max-w-4xl px-6 py-6 space-y-4">
        <button
          type="button"
          onClick={() => router.push(`/threads/${threadId}`)}
          className="smart-reply-studio__back flex items-center gap-1 text-sm text-indigo-600 hover:underline"
        >
          ← Back to Thread
        </button>

        <header className="smart-reply-studio__header rounded-lg border border-indigo-100 bg-indigo-50 p-4">
          <h1 className="text-lg font-semibold text-indigo-900">Smart Reply Studio</h1>
          <p className="mt-1 text-sm text-indigo-700">
            Chọn next actions từ summary, thêm context và preview trước khi generate.
          </p>
          <div className="mt-3 flex items-center gap-2 text-xs">
            <span className="text-indigo-700">Reply format:</span>
            <button
              type="button"
              onClick={() => setFormat("message")}
              className={`rounded px-2 py-1 ${
                format === "message"
                  ? "bg-indigo-600 text-white"
                  : "bg-white text-indigo-700 border border-indigo-200"
              }`}
            >
              Message
            </button>
            <button
              type="button"
              onClick={() => setFormat("email")}
              className={`rounded px-2 py-1 ${
                format === "email"
                  ? "bg-indigo-600 text-white"
                  : "bg-white text-indigo-700 border border-indigo-200"
              }`}
            >
              Email
            </button>
          </div>
        </header>

        <section className="smart-reply-studio__summary rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Step 1 - Summary mới nhất</h2>
              <p className="text-xs text-gray-600">
                Khuyến nghị cập nhật Summary để lấy Next Actions up-to-date trước khi generate.
              </p>
            </div>
            <button
              type="button"
              onClick={handleRefreshSummary}
              disabled={isRefreshingSummary}
              className="rounded border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-60"
            >
              {isRefreshingSummary ? "Refreshing..." : "Refresh Summary"}
            </button>
          </div>

          {summaryText ? (
            <div className="space-y-3">
              {parseTimelineSummary(summaryText).map((entry, idx) => (
                <div key={idx} className="rounded bg-gray-50 p-3 border-l-4 border-purple-300">
                  <p className="text-xs font-semibold text-purple-700 mb-1">{entry.date}</p>
                  <ul className="space-y-1 text-sm text-gray-700">
                    {entry.points.map((point, pidx) => (
                      <li key={pidx} className="flex items-start gap-2">
                        <span className="text-purple-400 mt-1">•</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded bg-amber-50 p-3 text-sm text-amber-700">
              Chưa có summary. Bạn có thể bấm Refresh Summary để AI tạo mới.
            </p>
          )}
        </section>

        <section className="smart-reply-studio__context rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-900">Step 2 - Chọn context cho AI</h2>

          <div className="mt-3 space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Next Actions từ Summary</p>
            {nextActions.length === 0 ? (
              <p className="rounded bg-amber-50 p-2 text-xs text-amber-700">
                Chưa có next actions. Hãy refresh summary để lấy dữ liệu mới.
              </p>
            ) : (
              <div className="space-y-2">
                {nextActions.map((action, index) => {
                  const checked = selectedNextActions.includes(action);
                  const parsed = parseActionItem(action);
                  return (
                    <label
                      key={`${index}-${action}`}
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                        checked
                          ? "border-indigo-300 bg-indigo-50"
                          : "border-gray-200 bg-white hover:border-indigo-200"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleNextAction(action)}
                        className="mt-1 h-4 w-4 cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700 mb-1">{parsed.action}</p>
                        {(parsed.priority || parsed.deadline) && (
                          <div className="flex items-center gap-2 flex-wrap">
                            {parsed.priority && (
                              <span className={getPriorityBadgeClass(parsed.priority)}>
                                {getDisplayPriority(parsed.priority)}
                              </span>
                            )}
                            {parsed.deadline && (
                              <span className="bg-sky-100 text-sky-700 border border-sky-200 px-2 py-0.5 rounded-full text-xs font-medium">
                                ⏰ {parsed.deadline}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-4">
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
              Additional Context (manual)
            </label>
            <textarea
              value={additionalContext}
              onChange={(e) => setAdditionalContext(e.target.value)}
              placeholder="Ví dụ: Khách đang cần cập nhật trước 16:00 hôm nay; ưu tiên giữ tone đồng cảm nhưng rõ cam kết."
              rows={4}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-black placeholder-gray-500 placeholder:font-medium focus:border-indigo-400 focus:outline-none"
            />
          </div>

          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-gray-600">
              User context budget: {userContextLength}/{USER_CONTEXT_BUDGET} ký tự
            </p>
            {isOverBudget && (
              <span className="text-xs font-medium text-red-600">Vượt giới hạn context</span>
            )}
          </div>
        </section>

        <section className="smart-reply-studio__preview rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-900">Step 3 - Preview context gửi cho AI</h2>
          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-gray-50 p-3 text-xs text-gray-700">
            {contextPreview || "(Chưa có context được chọn)"}
          </pre>

          <div className="mt-3 flex items-center justify-end">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating || isOverBudget}
              className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isGenerating ? "Generating..." : "Generate Smart Reply"}
            </button>
          </div>
        </section>

        {replies.length > 0 && (
          <section className="smart-reply-studio__replies rounded-lg border border-gray-200 bg-white p-4 space-y-2">
            <h2 className="text-sm font-semibold text-gray-900">Reply Suggestions</h2>

            {replies.map((reply, index) => (
              <article
                key={`${index}-${reply.subject || "no-subject"}`}
                className="rounded border border-indigo-100 bg-indigo-50 p-3"
              >
                {reply.subject && (
                  <p className="mb-1 text-xs font-semibold text-indigo-900">Subject: {reply.subject}</p>
                )}
                <p className="whitespace-pre-wrap text-sm text-gray-700">{reply.body}</p>
                <button
                  type="button"
                  onClick={() => handleUseReply(reply)}
                  className="mt-2 rounded bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700"
                >
                  Use this reply
                </button>
              </article>
            ))}
          </section>
        )}
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
