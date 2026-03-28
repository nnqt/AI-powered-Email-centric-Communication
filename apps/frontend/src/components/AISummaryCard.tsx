"use client";

import { ThreadSummary } from "@/hooks/useThreads";

interface ParsedAction {
  priority?: string;
  owner?: string;
  deadline?: string;
  action: string;
}

const ACTION_META_PATTERN =
  /^\s*\[Priority:\s*([^\]]+)\]\s*\[Owner:\s*([^\]]+)\]\s*\[Deadline:\s*([^\]]+)\]\s*(.+)$/i;

function parseActionItem(raw: string): ParsedAction {
  const normalized = raw.trim();
  const match = normalized.match(ACTION_META_PATTERN);

  if (!match) {
    return { action: normalized };
  }

  return {
    priority: match[1].trim(),
    owner: match[2].trim(),
    deadline: match[3].trim(),
    action: match[4].trim(),
  };
}

function getPriorityClass(priority?: string): string {
  const value = (priority || "").toLowerCase();
  if (value.includes("cao")) {
    return "bg-red-50 text-red-700 border border-red-200";
  }
  if (value.includes("trung")) {
    return "bg-amber-50 text-amber-700 border border-amber-200";
  }
  return "bg-slate-100 text-slate-700 border border-slate-200";
}

interface AISummaryCardProps {
  summary?: ThreadSummary;
  onGenerate: () => void;
  isGenerating: boolean;
}

export function AISummaryCard({
  summary,
  onGenerate,
  isGenerating,
}: AISummaryCardProps) {
  if (isGenerating) {
    return (
      <div className="ai-summary-card ai-summary-card--loading mb-4 rounded-lg border border-purple-200 bg-purple-50 p-4">
        <div className="ai-summary-card__spinner flex items-center gap-2">
          <svg
            className="h-5 w-5 animate-spin text-purple-600"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
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
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span className="text-sm font-medium text-purple-700">
            Generating AI summary...
          </span>
        </div>
      </div>
    );
  }

  if (!summary || !summary.text) {
    return (
      <div className="ai-summary-card ai-summary-card--empty mb-4">
        <button
          type="button"
          onClick={onGenerate}
          className="ai-summary-card__trigger flex items-center gap-2 rounded-lg border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100"
        >
          <span>✨</span>
          Summarize this Thread
        </button>
      </div>
    );
  }

  return (
    <div className="ai-summary-card mb-4 rounded-lg border border-purple-200 bg-purple-50 p-4">
      <div className="ai-summary-card__header mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-purple-800">
          <span>✨</span> AI Summary
        </h3>
        <button
          type="button"
          onClick={onGenerate}
          className="ai-summary-card__regenerate text-xs text-purple-600 hover:text-purple-800 hover:underline"
        >
          Regenerate
        </button>
      </div>
      <p className="mb-3 text-sm text-gray-700">{summary.text}</p>

      {summary.key_issues.length > 0 && (
        <div className="ai-summary-card__key-issues mb-3">
          <h4 className="mb-1 text-xs font-semibold uppercase text-purple-700">
            Key Issues
          </h4>
          <ul className="list-inside list-disc space-y-1 text-sm text-gray-600">
            {summary.key_issues.map((issue, idx) => (
              <li key={idx}>{issue}</li>
            ))}
          </ul>
        </div>
      )}

      {summary.action_required.length > 0 && (
        <div className="ai-summary-card__action-required">
          <h4 className="mb-1 text-xs font-semibold uppercase text-purple-700">
            Next Actions
          </h4>
          <ul className="space-y-2 text-sm text-gray-700">
            {summary.action_required.map((action, idx) => (
              <li
                key={idx}
                className="rounded-md border border-purple-100 bg-white/80 p-2.5"
              >
                {(() => {
                  const parsed = parseActionItem(action);
                  return (
                    <div className="flex items-start gap-2">
                      <svg
                        className="mt-0.5 h-4 w-4 shrink-0 text-purple-500"
                        viewBox="0 0 20 20"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                      >
                        <rect
                          x="3.5"
                          y="3.5"
                          width="13"
                          height="13"
                          rx="2"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        />
                      </svg>
                      <div className="flex-1 space-y-1">
                        {(parsed.priority || parsed.owner || parsed.deadline) && (
                          <div className="flex flex-wrap gap-1.5 text-xs">
                            {parsed.priority && (
                              <span
                                className={`rounded-full px-2 py-0.5 font-medium ${getPriorityClass(parsed.priority)}`}
                              >
                                Priority: {parsed.priority}
                              </span>
                            )}
                            {parsed.owner && (
                              <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 font-medium text-indigo-700">
                                Owner: {parsed.owner}
                              </span>
                            )}
                            {parsed.deadline && (
                              <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 font-medium text-sky-700">
                                Deadline: {parsed.deadline}
                              </span>
                            )}
                          </div>
                        )}
                        <p className="leading-relaxed text-gray-700">
                          {parsed.action}
                        </p>
                      </div>
                    </div>
                  );
                })()}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
