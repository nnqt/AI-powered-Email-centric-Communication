"use client";

export type PriorityLevel = "critical" | "high" | "medium" | "low";

export function scoreToPriority(score: number): PriorityLevel {
  if (score >= 120) return "critical";
  if (score >= 60) return "high";
  if (score >= 20) return "medium";
  return "low";
}

const PRIORITY_STYLES: Record<PriorityLevel, string> = {
  critical: "bg-red-100 text-red-700 border-red-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  low: "bg-gray-100 text-gray-500 border-gray-200",
};

interface Props {
  score: number;
  className?: string;
}

export function PriorityBadge({ score, className = "" }: Props) {
  const level = scoreToPriority(score);
  return (
    <span
      className={`priority-badge inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${PRIORITY_STYLES[level]} ${className}`}
      title={`Focus priority: ${level} (score ${score})`}
    >
      {level}
    </span>
  );
}
