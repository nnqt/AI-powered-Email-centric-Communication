"use client";

import { ThreadSummary } from "@/hooks/useThreads";

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
      <div className="mb-4 rounded-lg border border-purple-200 bg-purple-50 p-4">
        <div className="flex items-center gap-2">
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

  if (!summary) {
    return (
      <div className="mb-4">
        <button
          type="button"
          onClick={onGenerate}
          className="flex items-center gap-2 rounded-lg border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100"
        >
          <span>✨</span>
          Summarize this Thread
        </button>
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-lg border border-purple-200 bg-purple-50 p-4">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-purple-800">
        <span>✨</span> AI Summary
      </h3>
      <p className="mb-3 text-sm text-gray-700">{summary.text}</p>

      {summary.key_issues.length > 0 && (
        <div className="mb-3">
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
        <div>
          <h4 className="mb-1 text-xs font-semibold uppercase text-purple-700">
            Action Required
          </h4>
          <ul className="space-y-1 text-sm text-gray-600">
            {summary.action_required.map((action, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-purple-500">☐</span>
                {action}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
