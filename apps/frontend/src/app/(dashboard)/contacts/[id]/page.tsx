"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { format, formatDistanceToNow } from "date-fns";

import { useContactDetail } from "@/hooks/useContacts";
import { useUnifiedTimeline, TimelineItemDTO } from "@/hooks/useTimeline";
import { useSocket } from "@/hooks/useSocket";
import type { ContactCategory } from "@/hooks/useContacts";
import { useContactTopics } from "@/hooks/useContactTopics";
import type { TopicDTO } from "@/hooks/useContactTopics";
import { useToast } from "@/components/Toast";
import apiClient from "@/lib/api";
import ContactTopicGroup from "@/features/contacts/ContactTopicGroup";

const ALL_CATEGORIES: ContactCategory[] = [
  "colleague",
  "customer",
  "other",
  "spam",
  "unknown",
];

const CATEGORY_LABELS: Record<ContactCategory, string> = {
  colleague: "Colleague",
  customer: "Customer",
  spam: "Spam",
  other: "Other",
  unknown: "Unknown",
};

const CATEGORY_CHIP_STYLE: Record<ContactCategory, string> = {
  colleague: "bg-indigo-50 text-indigo-700 border-indigo-200",
  customer: "bg-green-50 text-green-700 border-green-200",
  spam: "bg-red-50 text-red-600 border-red-200",
  other: "bg-orange-50 text-orange-700 border-orange-200",
  unknown: "bg-gray-100 text-gray-500 border-gray-200",
};

/** Map ISO 639-1 codes to display labels */
const LANGUAGE_LABELS: Record<string, string> = {
  vi: "Tiếng Việt",
  en: "English",
  fr: "Français",
  de: "Deutsch",
  ja: "日本語",
  ko: "한국어",
  zh: "中文",
  es: "Español",
  pt: "Português",
};

function InfoRow({
  label,
  value,
  emptyTooltip = "Enrich with AI to fill",
}: {
  label: string;
  value?: string | null;
  emptyTooltip?: string;
}) {
  return (
    <div className="contact-detail__info-row flex flex-col sm:flex-row sm:items-start gap-0.5 sm:gap-4 py-2.5 border-b border-gray-100 last:border-0">
      <span className="w-36 shrink-0 text-xs font-medium text-gray-500 uppercase tracking-wide pt-0.5">
        {label}
      </span>
      {value ? (
        <span className="text-sm text-gray-900">{value}</span>
      ) : (
        <span
          className="text-sm text-gray-300 cursor-help select-none"
          title={emptyTooltip}
        >
          —
        </span>
      )}
    </div>
  );
}

export default function ContactDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const { showToast, updateToast } = useToast();

  const contactId = params.id as string;
  const userId = (session?.user as any)?.id as string | undefined;
  const { contact, isLoading, isError, mutate } = useContactDetail(contactId);
  const { timeline, isLoading: timelineLoading, mutate: mutateTimeline } =
    useUnifiedTimeline(contactId);
  const {
    topics,
    isLoading: topicsLoading,
    mutate: mutateTopics,
  } = useContactTopics(contactId);

  const [enriching, setEnriching] = useState(false);
  const [timelineView, setTimelineView] = useState<"flat" | "topics">("flat");
  const [localTopics, setLocalTopics] = useState<TopicDTO[] | null>(null);

  useSocket(userId, {
    CONTACTS_UPDATED: (payload: {
      targetId?: string;
      targetIds?: string[];
    }) => {
      const shouldRefresh =
        payload?.targetId === contactId ||
        (Array.isArray(payload?.targetIds) &&
          payload.targetIds.includes(contactId));

      if (!shouldRefresh) return;

      setLocalTopics(null);
      void mutate();
      void mutateTopics();
      void mutateTimeline();
    },
  });

  const displayedTopics = localTopics ?? topics;

  // ─── Inline edit state ───────────────────────────────────────────────────────
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editOrg, setEditOrg] = useState("");
  const [editLanguage, setEditLanguage] = useState("");
  const [editAltEmails, setEditAltEmails] = useState("");
  const [editCategories, setEditCategories] = useState<Set<ContactCategory>>(
    new Set(),
  );
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    const baseCategories = (contact?.categories?.filter((c) => c !== "unknown")
      ?.length
      ? contact.categories.filter((c) => c !== "unknown")
      : contact?.category && contact.category !== "unknown"
        ? [contact.category]
        : []) as ContactCategory[];

    setEditName(contact?.name ?? "");
    setEditOrg(contact?.org ?? "");
    setEditLanguage(contact?.language ?? "");
    setEditAltEmails(contact?.alternateEmails?.join(", ") ?? "");
    setEditCategories(new Set(baseCategories));
    setIsEditing(true);
  };

  const cancelEdit = () => setIsEditing(false);

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      const selectedCategories = Array.from(editCategories);
      await apiClient.patch(`/api/contacts/${contactId}`, {
        name: editName.trim() || undefined,
        org: editOrg.trim() || undefined,
        language: editLanguage.trim() || undefined,
        alternateEmails: editAltEmails
          .split(",")
          .map((e) => e.trim().toLowerCase())
          .filter(Boolean),
        categories: selectedCategories,
        category: selectedCategories.length > 0 ? selectedCategories[0] : "unknown",
        categorySource: "user",
        categoryAiSuggestion: null,
      });
      await mutate();
      showToast("Contact saved", "success");
      setIsEditing(false);
    } catch {
      showToast("Failed to save contact", "error");
    } finally {
      setSaving(false);
    }
  };

  // ─── AI category suggestion ───────────────────────────────────────────────
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);
  const [pendingCats, setPendingCats] = useState<Set<ContactCategory>>(
    new Set(),
  );

  // Initialize pending categories whenever a new AI suggestion arrives
  useEffect(() => {
    if (contact?.categoryAiSuggestion && contact.categorySource !== "user") {
      const initial = new Set<ContactCategory>(contact.categories ?? []);
      initial.add(contact.categoryAiSuggestion);
      setPendingCats(initial);
      setSuggestionDismissed(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact?.categoryAiSuggestion]);

  const togglePendingCat = (cat: ContactCategory) => {
    setPendingCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const toggleEditCategory = (cat: ContactCategory) => {
    setEditCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const handleConfirmCategories = async () => {
    const selected = Array.from(pendingCats);
    try {
      await apiClient.patch(`/api/contacts/${contactId}`, {
        categories: selected,
        category: selected.length > 0 ? selected[0] : "unknown",
        categorySource: "user",
        categoryAiSuggestion: null,
      });
      await mutate();
      setSuggestionDismissed(true);
      showToast("Categories saved", "success");
    } catch {
      showToast("Failed to save categories", "error");
    }
  };

  const handleDismissSuggestion = async () => {
    setSuggestionDismissed(true);
    try {
      await apiClient.patch(`/api/contacts/${contactId}`, {
        categoryAiSuggestion: null,
      });
      await mutate();
    } catch {
      // already dismissed locally
    }
  };

  const handleEnrich = async (force = false) => {
    setEnriching(true);
    const toastId = showToast("Enriching contact with AI…", "processing");
    try {
      const url = `/api/contacts/${contactId}/enrich${force ? "?force=true" : ""}`;
      const res = await apiClient.post(url);
      if (res.data?.cached) {
        updateToast(toastId, "Already enriched — showing saved data", "info");
      } else {
        await mutate();
        updateToast(toastId, "Contact enriched with AI", "success");
      }
    } catch {
      updateToast(toastId, "Enrichment failed", "error");
    } finally {
      setEnriching(false);
    }
  };

  if (status === "loading" || isLoading) {
    return (
      <div className="flex min-h-full items-center justify-center py-20">
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    );
  }

  if (status === "unauthenticated") {
    router.replace("/");
    return null;
  }

  if (isError || !contact) {
    return (
      <div className="flex min-h-full items-center justify-center py-20">
        <p className="text-sm text-red-500">Contact not found.</p>
      </div>
    );
  }

  const initials = contact.name
    ? contact.name
        .split(" ")
        .map((w: string) => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : contact.email[0].toUpperCase();

  // Determine enrichment completeness
  const isFullyEnriched =
    contact.aiEnriched && !!contact.org && !!contact.language;
  const needsEnrich = !contact.aiEnriched || !contact.org || !contact.language;

  const languageLabel = contact.language
    ? (LANGUAGE_LABELS[contact.language] ?? contact.language)
    : null;

  const lastThread = timeline?.[0];
  const lastInteraction = lastThread?.date
    ? formatDistanceToNow(new Date(lastThread.date), {
        addSuffix: true,
      })
    : null;

  return (
    <div className="contact-detail min-h-full bg-gray-50">
      {/* ── Top navigation bar ── */}
      <div className="contact-detail__topbar sticky top-0 z-10 border-b border-gray-200 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <button
            type="button"
            onClick={() => router.push("/contacts")}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 19.5L8.25 12l7.5-7.5"
              />
            </svg>
            Contacts
          </button>

          {/* Edit / Save / Cancel */}
          {isEditing ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={cancelEdit}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={saving}
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={startEdit}
              className="flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
            >
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
              Edit
            </button>
          )}

          {/* Enrich button — adapts based on state */}
          {!isEditing && isFullyEnriched ? (
            <button
              type="button"
              onClick={() => handleEnrich(true)}
              disabled={enriching}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-50 transition-colors"
              title="Re-run AI enrichment"
            >
              {enriching ? "Enriching…" : "↻ Re-enrich"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleEnrich(false)}
              disabled={enriching}
              className="flex items-center gap-1.5 rounded-md bg-purple-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-purple-700 disabled:opacity-50 transition-colors"
            >
              <span className="text-purple-200">✦</span>
              {enriching ? "Enriching…" : "Enrich with AI"}
            </button>
          )}
        </div>
      </div>

      <div className="contact-detail__container mx-auto max-w-3xl px-4 py-6 space-y-5">
        {/* ── Profile card ── */}
        <div className="contact-detail__profile rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          {/* Avatar + name header */}
          <div className="contact-detail__profile-header flex items-start gap-4 px-6 py-5 border-b border-gray-100">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-lg font-bold text-indigo-700 select-none">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-semibold text-gray-900 truncate">
                {contact.name ?? contact.email}
              </h1>
              {contact.name && (
                <p className="text-sm text-gray-500 truncate">
                  {contact.email}
                </p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {/* Enrichment status badge */}
                {needsEnrich ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                    Incomplete · Enrich with AI
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 border border-purple-200 px-2.5 py-0.5 text-xs font-medium text-purple-700">
                    <span>✦</span>
                    AI Enriched
                    {contact.enrichedAt && (
                      <span className="text-purple-400">
                        · {format(new Date(contact.enrichedAt), "MMM d, yyyy")}
                      </span>
                    )}
                  </span>
                )}
                {/* Category chips — show all confirmed categories */}
                {((contact.categories?.filter((c) => c !== "unknown") ?? [])
                  .length > 0
                  ? contact.categories!.filter((c) => c !== "unknown")
                  : contact.category && contact.category !== "unknown"
                    ? [contact.category]
                    : []
                ).map((cat) => (
                  <span
                    key={cat}
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                      CATEGORY_CHIP_STYLE[cat] ?? ""
                    }`}
                  >
                    {CATEGORY_LABELS[cat] ?? cat}
                    {contact.categorySource === "user" && (
                      <span className="ml-1 opacity-50">· confirmed</span>
                    )}
                  </span>
                ))}
                {/* Telegram badge */}
                {contact.telegramId && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 border border-blue-200 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                    <svg
                      className="h-3 w-3"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.892-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                    </svg>
                    Telegram
                  </span>
                )}
                {/* Thread count badge */}
                {!timelineLoading && timeline.length > 0 && (
                  <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">
                    {timeline.length} interaction{timeline.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 2-column info grid */}
          <div className="contact-detail__info px-6 py-4">
            <InfoRow label="Email" value={contact.email} />

            {/* Editable: Name */}
            <div className="contact-detail__info-row flex flex-col sm:flex-row sm:items-start gap-0.5 sm:gap-4 py-2.5 border-b border-gray-100">
              <span className="w-36 shrink-0 text-xs font-medium text-gray-500 uppercase tracking-wide pt-0.5">
                Name
              </span>
              {isEditing ? (
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Display name"
                  className="flex-1 text-black rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              ) : (
                <span
                  className={`text-sm ${contact.name ? "text-gray-900" : "text-gray-300"}`}
                >
                  {contact.name ?? "—"}
                </span>
              )}
            </div>

            {/* Editable: Organization */}
            <div className="contact-detail__info-row flex flex-col sm:flex-row sm:items-start gap-0.5 sm:gap-4 py-2.5 border-b border-gray-100">
              <span className="w-36 shrink-0 text-xs font-medium text-gray-500 uppercase tracking-wide pt-0.5">
                Organization
              </span>
              {isEditing ? (
                <input
                  type="text"
                  value={editOrg}
                  onChange={(e) => setEditOrg(e.target.value)}
                  placeholder="Acme Corp"
                  className="flex-1 text-black rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              ) : (
                <span
                  className={`text-sm ${contact.org ? "text-gray-900" : "text-gray-300"}`}
                >
                  {contact.org ?? "—"}
                </span>
              )}
            </div>

            {/* Editable: Language */}
            <div className="contact-detail__info-row flex flex-col sm:flex-row sm:items-start gap-0.5 sm:gap-4 py-2.5 border-b border-gray-100">
              <span className="w-36 shrink-0 text-xs font-medium text-gray-500 uppercase tracking-wide pt-0.5">
                Language
              </span>
              {isEditing ? (
                <select
                  value={editLanguage}
                  onChange={(e) => setEditLanguage(e.target.value)}
                  className="flex-1 text-black rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">— Select language —</option>
                  {Object.entries(LANGUAGE_LABELS).map(([code, label]) => (
                    <option key={code} value={code}>
                      {label} ({code})
                    </option>
                  ))}
                </select>
              ) : (
                <span
                  className={`text-sm ${languageLabel ? "text-gray-900" : "text-gray-300"}`}
                >
                  {languageLabel ?? "—"}
                </span>
              )}
            </div>

            {/* Editable: Alternate Emails */}
            <div className="contact-detail__info-row flex flex-col sm:flex-row sm:items-start gap-0.5 sm:gap-4 py-2.5 border-b border-gray-100">
              <span className="w-36 shrink-0 text-xs font-medium text-gray-500 uppercase tracking-wide pt-0.5">
                Alt. Emails
              </span>
              {isEditing ? (
                <div className="flex-1">
                  <input
                    type="text"
                    value={editAltEmails}
                    onChange={(e) => setEditAltEmails(e.target.value)}
                    placeholder="alias@example.com, other@example.com"
                    className="w-full text-black rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <p className="mt-0.5 text-xs text-gray-400">
                    Comma-separated
                  </p>
                </div>
              ) : (
                <span
                  className={`text-sm ${contact.alternateEmails.length > 0 ? "text-gray-900" : "text-gray-300"}`}
                >
                  {contact.alternateEmails.length > 0
                    ? contact.alternateEmails.join(", ")
                    : "—"}
                </span>
              )}
            </div>

            {/* Editable: Categories (multi-select) */}
            <div className="contact-detail__info-row flex flex-col sm:flex-row sm:items-start gap-0.5 sm:gap-4 py-2.5 border-b border-gray-100">
              <span className="w-36 shrink-0 text-xs font-medium text-gray-500 uppercase tracking-wide pt-0.5">
                Categories
              </span>
              {isEditing ? (
                <div className="flex-1">
                  <div className="flex flex-wrap gap-2">
                    {ALL_CATEGORIES.filter((cat) => cat !== "unknown").map((cat) => {
                      const selected = editCategories.has(cat);
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => toggleEditCategory(cat)}
                          className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                            selected
                              ? CATEGORY_CHIP_STYLE[cat]
                              : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
                          }`}
                        >
                          {CATEGORY_LABELS[cat]}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    You can select multiple categories.
                  </p>
                </div>
              ) : (
                <div className="flex-1">
                  {((contact.categories?.filter((c) => c !== "unknown") ?? [])
                    .length > 0
                    ? contact.categories!.filter((c) => c !== "unknown")
                    : contact.category && contact.category !== "unknown"
                      ? [contact.category]
                      : []
                  ).length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {((contact.categories?.filter((c) => c !== "unknown") ?? [])
                        .length > 0
                        ? contact.categories!.filter((c) => c !== "unknown")
                        : contact.category && contact.category !== "unknown"
                          ? [contact.category]
                          : []
                      ).map((cat) => (
                        <span
                          key={cat}
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                            CATEGORY_CHIP_STYLE[cat] ?? ""
                          }`}
                        >
                          {CATEGORY_LABELS[cat] ?? cat}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-sm text-gray-300">—</span>
                  )}
                </div>
              )}
            </div>

            <InfoRow
              label="Last Active"
              value={lastInteraction ?? null}
              emptyTooltip="No emails synced yet"
            />
            <InfoRow
              label="First Seen"
              value={
                contact.createdAt
                  ? format(new Date(contact.createdAt), "MMM d, yyyy")
                  : null
              }
            />
          </div>
        </div>

        {/* ── AI Category Suggestion — multi-select checklist ── */}
        {contact.categoryAiSuggestion &&
          contact.categorySource !== "user" &&
          !suggestionDismissed && (
            <div className="contact-detail__category-checklist rounded-xl border border-violet-200 bg-violet-50 px-5 py-4">
              <p className="text-sm font-semibold text-violet-900 mb-1">
                ✦ AI Category Suggestion
              </p>
              <p className="text-xs text-violet-600 mb-3">
                AI suggests{" "}
                <strong>
                  {CATEGORY_LABELS[contact.categoryAiSuggestion] ??
                    contact.categoryAiSuggestion}
                </strong>
                . Select all categories that apply, then confirm.
              </p>

              {/* Category checklist */}
              <div className="flex flex-wrap gap-2 mb-4">
                {ALL_CATEGORIES.map((cat) => {
                  const checked = pendingCats.has(cat);
                  return (
                    <label
                      key={cat}
                      className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors select-none ${
                        checked
                          ? "border-violet-400 bg-violet-100 text-violet-800"
                          : "border-gray-200 bg-white text-gray-600 hover:border-violet-300 hover:bg-violet-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={checked}
                        onChange={() => togglePendingCat(cat)}
                      />
                      <span
                        className={`h-3 w-3 rounded-sm border flex items-center justify-center ${
                          checked
                            ? "border-violet-500 bg-violet-500"
                            : "border-gray-300 bg-white"
                        }`}
                      >
                        {checked && (
                          <svg
                            className="h-2 w-2 text-white"
                            viewBox="0 0 12 12"
                            fill="currentColor"
                          >
                            <path
                              d="M10 3L5 8.5 2 5.5"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              fill="none"
                            />
                          </svg>
                        )}
                      </span>
                      {CATEGORY_LABELS[cat]}
                      {cat === contact.categoryAiSuggestion && (
                        <span className="ml-0.5 opacity-60 text-[10px]">
                          AI
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleConfirmCategories}
                  disabled={pendingCats.size === 0}
                  className="rounded-md bg-violet-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-40"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={handleDismissSuggestion}
                  className="text-sm text-violet-500 hover:text-violet-700 underline underline-offset-2"
                >
                  Skip
                </button>
              </div>
            </div>
          )}

        {/* ── Communication timeline ── */}
        <div className="contact-detail__timeline">
          {/* Header + view toggle */}
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
              {timelineView === "flat" ? "Communication Timeline" : "Topics"}
              {timelineView === "flat" && !timelineLoading && (
                <span className="rounded-full bg-gray-200 px-2 py-0.5 text-gray-600 normal-case font-medium">
                  {timeline.length}
                </span>
              )}
              {timelineView === "topics" && !topicsLoading && (
                <span className="rounded-full bg-gray-200 px-2 py-0.5 text-gray-600 normal-case font-medium">
                  {displayedTopics.length}
                </span>
              )}
            </h2>
            {/* Toggle buttons */}
            <div className="flex items-center rounded-lg border border-gray-200 bg-white overflow-hidden text-xs">
              <button
                type="button"
                onClick={() => setTimelineView("flat")}
                className={`px-3 py-1.5 font-medium transition-colors ${
                  timelineView === "flat"
                    ? "bg-indigo-600 text-white"
                    : "text-gray-500 hover:bg-gray-50"
                }`}
              >
                Timeline
              </button>
              <button
                type="button"
                onClick={() => setTimelineView("topics")}
                className={`px-3 py-1.5 font-medium transition-colors ${
                  timelineView === "topics"
                    ? "bg-indigo-600 text-white"
                    : "text-gray-500 hover:bg-gray-50"
                }`}
              >
                By Topic
              </button>
            </div>
          </div>

          {/* ── Flat timeline view ── */}
          {timelineView === "flat" && (
            <>
              {timelineLoading ? (
                <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
                  <p className="text-sm text-gray-400">Loading…</p>
                </div>
              ) : timeline.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 bg-white p-10 text-center">
                  <p className="text-sm text-gray-400">
                    No emails with this contact yet.
                  </p>
                </div>
              ) : (
                <div className="contact-detail__timeline-list overflow-hidden rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
                  {timeline.map((item: TimelineItemDTO) => (
                    <div
                      key={`${item.type}-${item.id}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        if (item.type === "email" && item.threadId) {
                          router.push(`/threads/${item.threadId}`);
                          return;
                        }
                        if (item.type === "telegram" && item.chatId) {
                          router.push(`/chat/${item.chatId}`);
                        }
                      }}
                      onKeyDown={(e) =>
                        e.key === "Enter" &&
                        (item.type === "email" && item.threadId
                          ? router.push(`/threads/${item.threadId}`)
                          : item.type === "telegram" && item.chatId
                            ? router.push(`/chat/${item.chatId}`)
                            : null)
                      }
                      className="contact-detail__timeline-item flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors group"
                    >
                      <div className="mt-1 h-5 w-5 shrink-0 flex items-center justify-center">
                        {item.type === "telegram" ? (
                           <svg className="h-4 w-4 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.892-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                           </svg>
                        ) : (
                           <svg className="h-4 w-4 text-indigo-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                           </svg>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-gray-900 font-medium">
                          {item.type === "email" ? (item.subject ?? "(no subject)") : (
                            <span className="flex items-center gap-1.5">
                               {item.isOutbound ? <span className="text-gray-400">You:</span> : null}
                               {item.text}
                            </span>
                          )}
                        </p>
                        {item.snippet && item.type === "email" && (
                          <p className="truncate text-xs text-gray-500 mt-0.5">
                            {item.snippet}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 text-xs text-gray-400 pt-0.5">
                        {item.date
                          ? formatDistanceToNow(
                              new Date(item.date),
                              { addSuffix: true },
                            )
                          : ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── Grouped by topic view ── */}
          {timelineView === "topics" && (
            <>
              {topicsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-12 rounded-xl bg-gray-100 animate-pulse"
                    />
                  ))}
                </div>
              ) : displayedTopics.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 bg-white p-10 text-center">
                  <p className="text-sm text-gray-400">
                    No topics clustered yet. Topics are built automatically
                    during email sync.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {displayedTopics.map((topic) => (
                    <ContactTopicGroup
                      key={topic._id}
                      topic={topic}
                      onRename={(id, name) =>
                        setLocalTopics((prev) =>
                          (prev ?? displayedTopics).map((t) =>
                            t._id === id ? { ...t, name } : t,
                          ),
                        )
                      }
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
