"use client";

import { useRouter } from "next/navigation";

interface SmartReplyBarProps {
  threadId: string;
}

export function SmartReplyBar({ threadId }: SmartReplyBarProps) {
  const router = useRouter();

  const handleOpenStudio = () => {
    router.push(`/threads/${threadId}/smart-reply?format=email`);
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

        {/* Open studio */}
        <button
          type="button"
          onClick={handleOpenStudio}
          className="rounded px-3 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
        >
          Open Studio
        </button>
      </div>

      <p className="smart-reply-bar__hint text-xs text-indigo-500">
        Open Smart Reply Studio để chọn next actions từ summary, thêm context,
        preview context và generate reply.
      </p>
    </div>
  );
}
