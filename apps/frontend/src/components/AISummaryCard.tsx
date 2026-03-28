"use client";

import { useState } from "react";
import { ThreadSummary } from "@/hooks/useThreads";

interface ParsedAction {
  priority?: string;
  deadline?: string;
  action: string;
}

interface TimelineEntry {
  date: string;
  points: string[];
}

// Parse natural language format: "action text (Priority | deadline)"
const ACTION_META_PATTERN =
  /^(.+?)\s*\(([^|]+)\s*\|\s*([^)]+)\)\s*$/i;

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
  const [collapsed, setCollapsed] = useState(!summary?.text);
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

  // Return collapsed view when collapsed
  if (collapsed) {
    return (
      <div className="ai-summary-card ai-summary-card--collapsed mb-4">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="flex w-full items-center justify-between rounded-lg border border-purple-200 bg-purple-50 px-4 py-3 text-sm font-medium text-purple-800 transition hover:bg-purple-100"
        >
          <span className="flex items-center gap-2">
            <span>✨</span>
            View AI Summary
          </span>
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
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
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onGenerate}
            className="ai-summary-card__regenerate text-xs text-purple-600 hover:text-purple-800 hover:underline"
          >
            Regenerate
          </button>
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="text-xs text-purple-600 hover:text-purple-800"
            aria-label="Collapse summary"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
        </div>
      </div>
      {/* Timeline view */}
      {(() => {
        const timeline = parseTimelineSummary(summary.text);
        return (
          <div className="mb-3 space-y-2">
            {timeline.map((entry, idx) => (
              <div key={idx} className="border-l-2 border-purple-300 pl-3">
                <p className="text-xs font-semibold text-purple-700">{entry.date}</p>
                <ul className="space-y-1 text-sm text-gray-700">
                  {entry.points.map((point, pidx) => (
                    <li key={pidx} className="list-disc list-inside">{point}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        );
      })()}

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
                        {parsed.priority || parsed.deadline ? (
                          <>
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
                            <p className="leading-relaxed text-gray-700">
                              {parsed.action}
                            </p>
                          </>
                        ) : (
                          <p className="leading-relaxed text-gray-700">
                            {parsed.action}
                          </p>
                        )}
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
